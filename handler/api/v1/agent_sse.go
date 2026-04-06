package v1

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/clawhost/clawhost/middleware"
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

// sseHub manages SSE client connections and event broadcasting
type sseHub struct {
	clients map[string]map[chan string]struct{} // agentID -> set of client channels
	mu      sync.RWMutex
}

var hub = &sseHub{
	clients: make(map[string]map[chan string]struct{}),
}

// register adds a client channel for an agent
func (h *sseHub) register(agentID string, ch chan string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.clients[agentID] == nil {
		h.clients[agentID] = make(map[chan string]struct{})
	}
	h.clients[agentID][ch] = struct{}{}
}

// unregister removes a client channel for an agent
func (h *sseHub) unregister(agentID string, ch chan string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.clients[agentID]; ok {
		delete(clients, ch)
		if len(clients) == 0 {
			delete(h.clients, agentID)
		}
	}
}

// broadcast sends an event to all clients for a given agent
func (h *sseHub) broadcast(agentID, eventType string, data interface{}) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	dataJSON, _ := json.Marshal(data)
	msg := fmt.Sprintf("event: %s\ndata: %s\n\n", eventType, string(dataJSON))
	clients := h.clients[agentID]
	for ch := range clients {
		select {
		case ch <- msg:
		default:
			// client buffer full, skip
		}
	}
}

// BroadcastPairingUpdate sends a pairing-update event to all SSE clients for an agent
func BroadcastPairingUpdate(agentID, channel string) {
	hub.broadcast(agentID, "pairing-update", map[string]string{
		"channel": channel,
	})
}

// AgentSSEStreams SSE events for an agent
// GET /agents/:id/events
func AgentSSEStreams(c echo.Context) error {
	agent := middleware.GetAgentFromContext(c)
	if agent == nil {
		return util.Forbidden(c, "not authorized")
	}

	if agent.Status != model.AgentStatusRunning {
		return util.BadRequest(c, "agent is not running")
	}

	w := c.Response().Writer
	flusher, ok := w.(http.Flusher)
	if !ok {
		return util.InternalError(c, "streaming not supported")
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	// Send initial keepalive
	fmt.Fprint(w, ":ok\n\n")
	flusher.Flush()

	// Register client
	ch := make(chan string, 16)
	hub.register(agent.ID, ch)
	defer hub.unregister(agent.ID, ch)

	// Keep connection alive with periodic keepalives
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()

	clientCtx := c.Request().Context()
	for {
		select {
		case <-clientCtx.Done():
			return nil
		case msg := <-ch:
			fmt.Fprint(w, msg)
			flusher.Flush()
		case <-ticker.C:
			fmt.Fprint(w, ":keepalive\n\n")
			flusher.Flush()
		}
	}
}

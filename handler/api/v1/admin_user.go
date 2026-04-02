package v1

import (
	"github.com/clawhost/clawhost/model"
	"github.com/clawhost/clawhost/util"
	"github.com/labstack/echo/v4"
)

func ListUsersAdmin(c echo.Context) error {
	users, err := model.ListUsers()
	if err != nil {
		return util.InternalError(c, "failed to list users")
	}
	return util.Success(c, users)
}

type UpdateUserAdminRequest struct {
	Role   string `json:"role,omitempty"`
	Status string `json:"status,omitempty"`
}

func UpdateUserAdmin(c echo.Context) error {
	id := c.Param("id")
	user, err := model.GetUserByID(id)
	if err != nil {
		return util.NotFound(c, "user not found")
	}

	var req UpdateUserAdminRequest
	if err := c.Bind(&req); err != nil {
		return util.BadRequest(c, "invalid request body")
	}

	if req.Role != "" {
		if req.Role != "user" && req.Role != "admin" {
			return util.BadRequest(c, "role must be 'user' or 'admin'")
		}
		user.Role = req.Role
	}
	if req.Status != "" {
		if req.Status != "active" && req.Status != "disabled" {
			return util.BadRequest(c, "status must be 'active' or 'disabled'")
		}
		user.Status = req.Status
	}

	if err := model.UpdateUser(user); err != nil {
		return util.InternalError(c, "failed to update user")
	}
	return util.Success(c, user)
}

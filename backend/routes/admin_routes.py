"""Protected admin/site-manager API routes."""

from __future__ import annotations

import os
import uuid

from flask import Blueprint, g, jsonify, request, send_from_directory

try:
    # Works when backend/ is the active source root.
    from routes.auth_guards import login_required, role_required
    from services.admin_service import (
        AdminNotFoundError,
        AdminService,
        AdminServiceError,
        AdminValidationError,
    )
except ImportError:
    # Works when workspace root is the active source root.
    from backend.routes.auth_guards import login_required, role_required
    from backend.services.admin_service import (
        AdminNotFoundError,
        AdminService,
        AdminServiceError,
        AdminValidationError,
    )


admin_bp = Blueprint("admin", __name__)

_ALLOWED_UPLOAD_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}


@admin_bp.post("/api/admin/upload-image")
@login_required
@role_required("site_manager", "admin", permission_code="site_admin")
def upload_content_image():
    """Accept a multipart image upload and save it to uploads/contentImages."""
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in _ALLOWED_UPLOAD_EXTENSIONS:
        return jsonify({"error": "סוג קובץ לא נתמך. מותר: jpg, png, gif, webp"}), 400

    safe_name = f"{uuid.uuid4().hex}.{ext}"
    upload_folder = os.path.join(os.path.dirname(__file__), "..", "uploads", "contentImages")
    os.makedirs(upload_folder, exist_ok=True)
    file.save(os.path.join(upload_folder, safe_name))

    return jsonify({"url": f"/uploads/contentImages/{safe_name}"}), 200


@admin_bp.get("/api/admin/content-items")
@login_required
@role_required("site_manager", "admin", permission_code="site_admin")
def list_admin_content_items():
    """List content items for admin management table."""
    service = AdminService()
    payload = request.args.to_dict(flat=True)

    try:
        data = service.list_content_items(payload)
        return jsonify(data), 200
    except AdminServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500


@admin_bp.get("/api/admin/content-items/<int:content_item_id>")
@login_required
@role_required("site_manager", "admin", permission_code="site_admin")
def get_admin_content_item(content_item_id: int):
    """Return one content item payload for admin edit form."""
    service = AdminService()

    try:
        data = service.get_content_item_for_edit(content_item_id)
        return jsonify(data), 200
    except AdminNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except AdminServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500


@admin_bp.post("/api/admin/content-items")
@login_required
@role_required("site_manager", "admin", permission_code="site_admin")
def create_admin_content_item():
    """Create a new content item from admin panel."""
    service = AdminService()
    payload = request.get_json(silent=True) or {}
    current_user_id = int(g.current_user["id"])

    try:
        data = service.create_content_item(payload, current_user_id)
        return jsonify(data), 201
    except AdminValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except AdminServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500


@admin_bp.put("/api/admin/content-items/<int:content_item_id>")
@login_required
@role_required("site_manager", "admin", permission_code="site_admin")
def update_admin_content_item(content_item_id: int):
    """Update an existing content item from admin panel."""
    service = AdminService()
    payload = request.get_json(silent=True) or {}
    current_user_id = int(g.current_user["id"])

    try:
        data = service.update_content_item(content_item_id, payload, current_user_id)
        return jsonify(data), 200
    except AdminValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except AdminNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except AdminServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500


@admin_bp.patch("/api/admin/content-items/<int:content_item_id>/status")
@login_required
@role_required("site_manager", "admin", permission_code="site_admin")
def patch_admin_content_item_status(content_item_id: int):
    """Patch content-item status and active flag from admin panel."""
    service = AdminService()
    payload = request.get_json(silent=True) or {}
    current_user_id = int(g.current_user["id"])

    try:
        data = service.patch_status(content_item_id, payload, current_user_id)
        return jsonify(data), 200
    except AdminValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except AdminNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except AdminServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500


@admin_bp.post("/api/admin/content-items/<int:content_item_id>/submit-for-approval")
@login_required
@role_required(permission_code="site_admin")
def submit_admin_content_item_for_approval(content_item_id: int):
    """Submit draft content item into pending approval workflow."""
    service = AdminService()
    current_user_id = int(g.current_user["id"])

    try:
        data = service.submit_for_approval(content_item_id, current_user_id)
        return jsonify(data), 200
    except AdminValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except AdminNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except AdminServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500


@admin_bp.post("/api/admin/content-items/<int:content_item_id>/approve")
@login_required
@role_required(permission_code="approver")
def approve_admin_content_item(content_item_id: int):
    """Approve content item that is currently waiting for approval."""
    service = AdminService()
    current_user_id = int(g.current_user["id"])

    try:
        data = service.approve_content(content_item_id, current_user_id)
        return jsonify(data), 200
    except AdminValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except AdminNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except AdminServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500


@admin_bp.delete("/api/admin/content-items/<int:content_item_id>")
@login_required
@role_required("site_manager", "admin", permission_code="site_admin")
def deactivate_admin_content_item(content_item_id: int):
    """Safely deactivate/archive content item instead of hard delete."""
    service = AdminService()
    current_user_id = int(g.current_user["id"])

    try:
        data = service.deactivate_content_item(content_item_id, current_user_id)
        return jsonify(data), 200
    except AdminValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except AdminNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except AdminServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500


@admin_bp.get("/api/admin/content-metadata")
@login_required
@role_required("site_manager", "admin", permission_code="site_admin")
def get_admin_content_metadata():
    """Return metadata/lookup lists used by admin create/edit forms."""
    service = AdminService()

    try:
        data = service.get_admin_metadata()
        return jsonify(data), 200
    except AdminServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500


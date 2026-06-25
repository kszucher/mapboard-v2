from fastapi import status


class GraphboardError(Exception):
    """Base class for all Graphboard exceptions."""

    def __init__(self, message: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ValidationError(GraphboardError):
    """Raised when validation fails."""

    pass


class NotFoundError(GraphboardError):
    """Raised when a resource is not found."""

    def __init__(self, message: str):
        super().__init__(message, status_code=status.HTTP_404_NOT_FOUND)


class ConflictError(GraphboardError):
    """Raised when there is a conflict (e.g. duplicate resource)."""

    def __init__(self, message: str):
        super().__init__(message, status_code=status.HTTP_409_CONFLICT)

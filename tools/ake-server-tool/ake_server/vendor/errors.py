class AkeToolError(Exception):
    """Base exception for expected tool failures."""


class CancelledError(AkeToolError):
    """Raised when the current job is cancelled by the user."""


class ValidationError(AkeToolError):
    """Raised when downloaded or unpacked data fails validation."""

class APIException(Exception):
    """Base API Exception with custom status code and error code"""
    def __init__(self, message, status_code=500, error_code=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = error_code or status_code

class ValidationError(APIException):
    """Validation Error Exception"""
    def __init__(self, message, error_code=4001):
        super().__init__(message, status_code=400, error_code=error_code)

class AuthenticationError(APIException):
    """Authentication Error Exception"""
    def __init__(self, message, error_code=4011):
        super().__init__(message, status_code=401, error_code=error_code)

class AuthorizationError(APIException):
    """Authorization Error Exception"""
    def __init__(self, message, error_code=4031):
        super().__init__(message, status_code=403, error_code=error_code)

class NotFoundError(APIException):
    """Not Found Error Exception"""
    def __init__(self, message, error_code=4041):
        super().__init__(message, status_code=404, error_code=error_code)

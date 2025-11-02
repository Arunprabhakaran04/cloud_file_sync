from loguru import logger
import sys

# Remove default handler
logger.remove()

# Add custom handler with clean, pretty format
logger.add(
    sys.stderr,
    format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{extra[name]}</cyan> - <level>{message}</level>",
    level="INFO",
    colorize=True,
)

def get_logger(name: str):
    """Get a configured logger with context."""
    return logger.bind(name=name)

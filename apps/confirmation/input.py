from django.conf import settings

from apps.shared import tools, types_


tools = tools
types_ = types_

base_url = settings.BASE_URL

session_code_length = settings.CONFIRMATION_SESSION_CODE_LENGTH
activation_code_length = settings.CONFIRMATION_ACTIVATION_CODE_LENGTH

activity_minutes = settings.CONFIRMATION_ACTIVITY_MINUTES
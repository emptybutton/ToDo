from django.urls import path

from confirmation.views import confirm


app_name = "confirmation"

urlpatterns = [
    path(
        "confirm/<str:subject>/<str:method>/<str:token>",
        confirm,
        name="confirm"
    ),
]

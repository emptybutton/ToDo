from typing import Iterable

from act import bad, by
from django.conf import settings
from django.contrib import auth
from django.contrib.auth.decorators import login_required
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect
from django.urls import reverse
from django.views.decorators.http import require_GET

from apps.access import ui, forms
from apps.access.adapters import controllers
from apps.access.lib import confirmation, for_anonymous, messages_of, event_bus


type _ErrorMesages = bad[Iterable[str]]


@confirmation.register_for(
    confirmation.subjects.authorization,
    confirmation.via.email,
)
def authorization_confirmation(
    request: HttpRequest,
    email: str,
) -> HttpResponse | _ErrorMesages:
    try:
        controllers.authorization.complete_by(email, request)
    except ExceptionGroup as group:
        message_of = ui.authorization.completion.messages_of
        return bad(messages_of(group, message_of))

    return redirect(reverse("map:map-selection"))


@confirmation.register_for(
    confirmation.subjects.registration,
    confirmation.via.email,
)
def registration_confirmation(
    request: HttpRequest,
    email: str,
) -> HttpResponse | _ErrorMesages:
    try:
        controllers.registration.complete_by(email, request)
    except ExceptionGroup as group:
        message_of = (
            ui.registration.completion.messages_of
            |by| reverse("access:sign-in")
        )
        return bad(messages_of(group, message_of))

    return redirect(reverse("map:map-selection"))


@confirmation.register_for(
    confirmation.subjects.access_recovery,
    confirmation.via.email,
)
def access_recovery_confirmation(
    request: HttpRequest,
    email: str,
) -> HttpResponse | _ErrorMesages:
    try:
        controllers.access_recovery.complete_by(email, request)
    except ExceptionGroup as group:
        message_of = ui.access_recovery.completion.messages_of
        return bad(messages_of(group, message_of))

    return redirect(reverse("map:map-selection"))


@login_required
@require_GET
def logout(request: HttpRequest) -> HttpResponse:
    auth.logout(request)

    return redirect(settings.LOGIN_URL)


class _LoginView(confirmation.OpeningView):
    _form_type = forms.UserLoginForm
    _template_name = "access/login.html"

    @staticmethod
    def _open_port(request: HttpRequest) -> str | bad[list[str]]:
        try:
            return controllers.authorization.open_using(
                name=request.POST["name"],
                password=request.POST["password"],
            )
        except ExceptionGroup as group:
            message_of = ui.authorization.opening.messages_of
            return bad(messages_of(group, message_of))


class _RegistrationView(confirmation.OpeningView):
    _form_type = forms.UserRegistrationForm
    _template_name = "access/registration.html"

    @staticmethod
    def _open_port(request: HttpRequest) -> str | _ErrorMesages:
        try:
            return controllers.registration.open_using(
                request.POST["name"],
                request.POST["email"],
                request.POST["new_password"],
                request.POST["password_to_repeat"],
            )
        except ExceptionGroup as group:
            message_of = ui.registration.opening.messages_of
            return bad(messages_of(group, message_of))


class _AccessRecoveryByNameView(confirmation.OpeningView):
    _form_type = forms.RestoringAccessByNameForm
    _template_name = "access/recovery-by-name.html"

    def _open_port(self, request: HttpRequest) -> str | _ErrorMesages:
        try:
            return controllers.access_recovery.open_using_name(
                request.POST["name"],
                request.POST["new_password"],
                request.POST["password_to_repeat"],
            )
        except ExceptionGroup as group:
            message_of = ui.access_recovery.opening.using_name_messages_of
            return bad(messages_of(group, message_of))


class _AccessRecoveryByEmailView(confirmation.OpeningView):
    _form_type = forms.RestoringAccessByEmailForm
    _template_name = "access/recovery-by-email.html"

    def _open_port(self, request: HttpRequest) -> str | _ErrorMesages:
        try:
            return controllers.access_recovery.open_using_email(
                request.POST["email"],
                request.POST["new_password"],
                request.POST["password_to_repeat"],
            )
        except ExceptionGroup as group:
            message_of = ui.access_recovery.opening.using_email_messages_of
            return bad(messages_of(group, message_of))


registrate = for_anonymous(_RegistrationView.as_view())

login = for_anonymous(_LoginView.as_view())

restore_access_by_name = for_anonymous(_AccessRecoveryByNameView.as_view())

restore_access_by_email = for_anonymous(_AccessRecoveryByEmailView.as_view())


event_bus.add_event(
    controllers.registration.roll_back_completion,
    "user_registration_is_failed",
)

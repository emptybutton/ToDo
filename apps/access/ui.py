from typing import Any, Iterable

from act import val, type
from django.urls import reverse

from apps.access import errors, types_, lib


User = type(name=types_.Username, email=types_.Email)


@val
class profile:
    def page_of(user: User) -> lib.ui.LazyPage:
        context = dict(name=user.name, email=lib.half_hidden(user.email, 4))

        return lib.ui.LazyPage("access/profile.html", context)


def username_error_messages_of(error: Any) -> Iterable[str]:
    if isinstance(error, errors.UsernameTooShort):
        yield "Your name must be more than 2 characters"

    if isinstance(error, errors.UsernameTooLong):
        yield "Your name must be 128 characters maximum"


def password_error_messages_of(error: Any) -> Iterable[str]:
    if isinstance(error, errors.PasswordPower):
        yield (
            "Your password must contain at least one number, "
            "an uppercase and lowercase Latin letter and a special character"
        )

    if isinstance(error, errors.PasswordTooLong):
        yield "Your password must be 128 characters maximum"


def user_validation_error_messages_of(error: Any) -> Iterable[str]:
    yield from username_error_messages_of(error)
    yield from password_error_messages_of(error)


def completion_error_messages_of(error: Any) -> Iterable[str]:
    if isinstance(error, errors.NoUser):
        yield "Go back and enter your data again"


def user_existence_error_messages_of(error: Any) -> Iterable[str]:
    if isinstance(error, errors.NoUser):
        yield "Make sure you entered your data correctly"


def confirmation_error_messages_of(error: Any) -> Iterable[str]:
    if isinstance(error, errors.Confirmation):
        yield (
            "Unable to confirm. "
            "Try again after a while or contact tech. "
            "support if all attempts are unsuccessful"
        )


@val
class registration:
    @val
    class opening:
        def error_messages_of(
            error: Any,
            name: types_.Username,
        ) -> Iterable[str]:
            if isinstance(error, errors.UserExists):
                yield f"User \"{name}\" already exists"
            if isinstance(error, errors.EmailConfirmation):
                yield "Make sure you entered your email correctly"

            yield from user_validation_error_messages_of(error)

    @val
    class completion:
        def error_messages_of(error: Any) -> Iterable[str]:
            if isinstance(error, errors.UserExists):
                yield (
                    f"User registration has already been completed. "
                    f"Login <a href=\"{reverse("access:sign-in")}\">here<a/>"
                )

            yield from completion_error_messages_of(error)


@val
class authorization:
    @val
    class opening:
        def error_messages_of(error: Any) -> Iterable[str]:
            yield lib.search(
                error,
                confirmation_error_messages_of,
                user_existence_error_messages_of,
            )

    @val
    class completion:
        def error_messages_of(error: Any) -> Iterable[str]:
            yield completion_error_messages_of(error)


@val
class access_recovery:
    @val
    class opening:
        def error_messages_of(error: Any) -> Iterable[str]:
            yield user_existence_error_messages_of(error)

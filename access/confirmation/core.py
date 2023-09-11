__all__ = (
    "Subject", "ReadableSubject", "AuthToken", "IdGroup", "id_groups",
    "subjects", "handler_of", "handle", "activate_by", "open_email_port_of"
)

Subject: TypeAlias = str
ReadableSubject: TypeAlias = str
AuthToken: TypeAlias = str
IdGroup: TypeAlias = str


@via_indexer
def HandlerRepositoryOf(handle_annotation: Annotaton) -> Annotaton
    return temp(
        registrate_for=Callable[PortID, reformer_of[handle_annotation]],
        get_of=Callable[PortID, handle_annotation],
    )


@via_indexer
def _AuthTokenSenderOf(
    id_annotation: Annotaton,
    access_token_annotation: Annotaton,
) -> Annotaton:
    return Callable[
        [id_annotation, ReadableSubject, access_token_annotation, Password],
        bool,
    ]


@dataclass(frozen=True)
class PortID(Generic[_IdGroupT]):
    subject: Subject
    id_group: IdGroup


@dataclass(frozen=True)
class PortAccess:
    port_id: PortID
    token: AuthToken
    password: Password


@dataclass(frozen=True)
class PortAccessView(Generic[I, A]):
    id_: I
    subject: Subject
    access_token: A
    password: Password


_ClosableHandler: TypeAlias = Callable[Concatenate[AuthToken, Pm], R]


def closing(
    repository: HandlerRepositoryOf[Callable[Pm, R]],
    close_port_of: Callable[[PortID, AuthToken], None],
) -> HandlerRepositoryOf[_ClosableHandler]:
    def registrate_for(
        port_id: PortID,
    ) -> Callable[Callable[Pm, R], _ClosableHandler]:
        def decorator(handle: Callable[Pm, R]) -> _ClosableHandler:
            def decorated_handler(
                token: AuthToken,
                *args: Pm.args,
                **kwargs: Pm.kwargs,
            ) -> R:
                result = handle(*args, **kwargs)
                close_port_of(port_id, token)

                return result

            repository.registrate_for(decorated_handler)

            return decorated_handler

        return decorator

    return obj(get_of=repository.get_of, registrate_for=registrate_for)


def open_port_of(
    subject: Subject,
    *,
    for_: contextual[IdGroup, I],
    generate_auth_token: Callable[[], AuthToken],
    generate_password: Callable[[], Password],
    password_hash_of: Callable[Password, PasswordHash],
    access_token_of: Callable[[Subject, AuthToken], A],
    notify_by: Callable[PortAccessView[I, A], bool],
    create_port_from: Callable[[PortID, AuthToken, PasswordHash, I], bool],
) -> Optional[A]:
    id_group, id_ = for_

    auth_token = generate_auth_token()
    password = generate_password()
    password_hash = password_hash_of(password)

    access_token = access_token_of(subject, auth_token)

    notify = will(notify_by)(PortView(id_, subject, access_token, password))

    create_port = will(create_port_from)(
        PortID(subject, id_group), password_hash, id_
    )

    return transactionally_for(access_token)(notify, create_port)


def activate_by(
    access: PortAccess,
    password_hash_of: Callable[[Subject, AuthToken], Optional[PasswordHash]],
    hash_equals: Callable[[Password, PasswordHash], bool],
    id_of: Callable[[IdGroup, AuthToken], I],
    handler_of: Callable[PortID, Callable[I, R]],
) -> Optional[HttpRequest]:
    password_hash = password_hash_of(access.port_id.subject, access.token)
    is_password_correct = (
        password_hash is not None
        and hash_equals(access.password, password_hash)
    )

    if not is_password_correct:
        return None

    id_ = id_of(access.port_id.id_group, access.token)

    return handler_of(access.port_id)(id_)
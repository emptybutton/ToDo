from contextlib import AbstractContextManager
from typing import Callable, Iterable, Optional, Any

from act import val, struct, type

from apps.map.core import rules, errors
from apps.map.lib import to_raise_multiple_errors, raise_, last, latest, exists


@val
class users[ID: int]:
    @struct
    class UserRepo:
        user_of: Callable[ID, rules.User]
        saved: Callable[rules.User, rules.User]

    EventBus = type(sent_failed_registration_message_with=Callable[ID, str])

    UoW = Callable[UserRepo, AbstractContextManager]

    def on_is_registred(
        id: int,
        first_user_map_name: str,
        *,
        user_repo: UserRepo,
        uow: UoW,
        event_bus: EventBus,
    ) -> Optional[rules.User]:
        user = user_repo.user_of(id)

        if user is not None:
            return user

        user = rules.users.created_with(id, first_user_map_name)

        with uow(user_repo):
            try:
                return user_repo.saved(user)
            except Exception as error:
                event_bus.sent_failed_registration_message_with(id)

                raise error from error


@val
class tasks:
    UserRepo = type(
        get_current=Callable[[], Optional[rules.User]],
        user_having=Callable[rules.Task, Optional[rules.User]],
    )
    TopMapRepo = type(top_map_of=Callable[int, Optional[rules.TopMap]])
    TaskRepo = type(
        task_of=Callable[int, Optional[rules.Task]],
        saved=Callable[rules.Task, rules.Task],
        committed=Callable[rules.Task, rules.Task],
    )
    UoW = Callable[TaskRepo, AbstractContextManager]

    @struct
    class Service:
        is_in: Callable[[Iterable[rules.TopMap], rules.TopMap], bool]
        add_to: Callable[[Iterable[rules.Task], rules.Task], Any]

    @to_raise_multiple_errors
    def add(
        top_map_id: int,
        description: str,
        status_code: int,
        x: int,
        y: int,
        *,
        user_repo: UserRepo,
        top_map_repo: TopMapRepo,
        task_repo: TaskRepo,
        uow: UoW,
        service: Service,
    ) -> rules.Task:
        current_user = user_repo.get_current()
        yield from exists(current_user, errors.NoCurrentUser())

        top_map = top_map_repo.top_map_of(top_map_id)
        yield from exists(top_map, errors.NoTopMap())

        yield raise_

        if not service.is_in(current_user.maps, top_map):
            yield last(errors.DeniedAccessToTopMap())

        with uow(task_repo):
            task = task_repo.saved(rules.tasks.created_with(
                description, status_code, x, y,
            ))

            service.add_to(top_map.tasks, task)

        return task

    @to_raise_multiple_errors
    def on_top_map_with_id(
        top_map_id: int,
        *,
        top_map_repo: TopMapRepo,
    ) -> Iterable[rules.Task]:
        top_map = top_map_repo.top_map_of(top_map_id)
        yield from latest(exists(top_map, errors.NoTopMap()))

        return top_map.tasks

    @to_raise_multiple_errors
    def update_by_id(
        task_id: int,
        description: str,
        status_code: int,
        x: int,
        y: int,
        *,
        tasks: TaskRepo,
        users: UserRepo,
        uow: UoW,
    ) -> rules.Task:
        yield from rules.tasks.is_status_code_valid(status_code)

        task = tasks.task_of(task_id)
        yield from exists(task, errors.NoTask())

        current_user = users.get_current()
        yield from exists(current_user, errors.NoCurrentUser())

        task_owner = users.user_having(task)
        yield from exists(task_owner, errors.NoTaskOwner())

        yield raise_

        if current_user.id != task_owner.id:
            yield last(errors.DeniedAccessToTask())

        with uow(tasks):
            task.description = description
            task.status = rules.TaskStatus(status_code)
            task.position.x = x
            task.position.y = y

            return tasks.committed(task)


@val
class top_maps:
    UserRepo = type(get_current=Callable[[], Optional[rules.User]])

    @to_raise_multiple_errors
    def get_all(*, user_repo: UserRepo) -> Iterable[rules.TopMap]:
        current_user = user_repo.get_current()
        yield from latest(exists(current_user, errors.NoCurrentUser()))

        return current_user.maps

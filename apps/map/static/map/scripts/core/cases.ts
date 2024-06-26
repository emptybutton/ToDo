import * as domain from "./domain.js";
import * as controllers from "./ports/controllers.js";
import * as messages from "./ports/messages.js";
import * as remoteRepos from "./ports/remote-repos.js";
import * as repos from "./ports/repos.js";
import * as timeouts from "./ports/timeouts.js";
import * as views from "./ports/views.js";

const fixationTime: timeouts.Milliseconds = 600;

export async function drawMap<MapRootView, MapView, TaskView, TaskAddingView>(
    mapRootView: MapRootView,
    mapViewMatching: repos.MaybeMatchingBy<domain.Map, MapView>,
    taskControllerMatching: repos.MaybeMatchingBy<TaskView, controllers.Controller[]>,
    taskAddingAvailabilityControllerMatching: repos.MaybeMatchingBy<MapView, controllers.Controller>,
    mapViews: views.Views<MapView>,
    mapPresenter: views.Presenter<MapRootView, MapView, domain.Map>,
    remoteTasks: remoteRepos.RemoteTasks,
    taskViews: views.Subviews<MapView, TaskView, domain.Task>,
    taskPresenter: views.Presenter<MapView, TaskView, domain.Task>,
    taskMatching: repos.MaybeMatchingBy<TaskView, domain.Task>,
    taskControllerFactroris: controllers.ControllerFor<TaskView, domain.Task>[],
    notify: messages.Notify,
    logError: messages.Log,
    getCurrentMap: () => domain.Map,
    taskAddingView: TaskAddingView,
    taskAddingAvailabilityControllerFor: controllers.StaticControllerFor<TaskAddingView>,
): Promise<void> {
    const map: domain.Map = getCurrentMap();
    let mapView = mapViewMatching.matchedWith(map);

    if (mapView !== undefined)
        mapPresenter.redrawBy(map, mapView);
    else {
        mapView = mapViews.createEmptyView();
        mapPresenter.redrawBy(map, mapView);
        mapPresenter.drawOn(mapRootView, mapView);

        mapViewMatching.match(map, mapView);
    }

    const tasks = await remoteTasks.tasksOn(map);

    if (tasks === undefined) {
        notify("All your tasks could not be displayed.");
        logError(`Failed to get remote tasks on map with id = ${map.id}`);
        return;
    }

    let numberOfUndisplayedTasks = 0;

    for await (const task of tasks) {
        if (task === undefined) {
            numberOfUndisplayedTasks++;
            continue;
        }

        let taskView = taskViews.foundViewOn(mapView, task);

        if (taskView === undefined) {
            taskView = taskViews.createEmptyView();
            taskPresenter.redrawBy(task, taskView);
            taskPresenter.drawOn(mapView, taskView);
        }
        else {
            taskPresenter.redrawBy(task, taskView);
        }

        taskMatching.match(taskView, task);

        let taskControllers = taskControllerMatching.matchedWith(taskView);

        if (taskControllers === undefined) {
            taskControllers = taskControllerFactroris.map(f => f(taskView, task));
            taskControllers.forEach(c => c.activate());

            taskControllerMatching.match(taskView, taskControllers);
        }
    }

    if (numberOfUndisplayedTasks !== 0) {
        notify("Some of your tasks could not be displayed.");
        logError(
            `Failed to get ${numberOfUndisplayedTasks} remote tasks from map with id = ${map.id}`
        );
    }

    let taskAddingAvailabilityController = (
        taskAddingAvailabilityControllerMatching.matchedWith(mapView)
    );

    if (taskAddingAvailabilityController === undefined) {
        taskAddingAvailabilityController = taskAddingAvailabilityControllerFor(taskAddingView);
        taskAddingAvailabilityControllerMatching.match(mapView, taskAddingAvailabilityController);
    }

    taskAddingAvailabilityController.activate();
}

export function changeTaskMode<MapView, TaskView>(
    view: TaskView,
    matching: repos.MaybeMatchingBy<TaskView, domain.Task>,
    logError: messages.Log,
    presenter: views.Presenter<MapView, TaskView, domain.Task>,
): void {
    let task = matching.matchedWith(view);

    if (task === undefined) {
        logError("No matching between task and view");
        return;
    }

    task.changeMode();
    presenter.redrawBy(task, view);
}

export function changeTaskDescription<MapView, TaskView>(
    taskMatching: repos.MaybeMatchingBy<TaskView, domain.Task>,
    presenter: views.Presenter<MapView, TaskView, domain.Task>,
    logError: messages.Log,
    fixationTimeout: timeouts.Timeout,
    remoteTasks: remoteRepos.RemoteTasks,
    taskView: TaskView,
    descriptionValue: string,
): void {
    let task = taskMatching.matchedWith(taskView);

    if (task === undefined) {
        logError("No matching between task and view");
        return;
    }

    const newDescription = domain.Description.of(descriptionValue);

    if (newDescription === undefined || task.description.value === newDescription.value)
        return;

    task.description = newDescription;
    presenter.redrawBy(task, taskView);

    fixationTimeout.executeIn(fixationTime, async () => {
        const updatedTask = await remoteTasks.withUpToDateDescription(task);

        if (updatedTask === undefined)
            logError("The remote task description could not be updated");
    });
}

export function prepareTaskMoving<TaskView>(
    taskMatching: repos.MaybeMatchingBy<TaskView, domain.Task>,
    readyToMoveTaskPresenter: views.DynamicPresenter<TaskView, domain.Task>,
    taskView: TaskView,
): void {
    const task = taskMatching.matchedWith(taskView);

    if (task?.mode === domain.InteractionMode.moving)
        readyToMoveTaskPresenter.redrawBy(task, taskView);
}

export function cancelTaskMoving<TaskView>(
    taskMatching: repos.MaybeMatchingBy<TaskView, domain.Task>,
    staticTaskPresenter: views.DynamicPresenter<TaskView, domain.Task>,
    taskView: TaskView,
): void {
    const task = taskMatching.matchedWith(taskView);

    if (task?.mode === domain.InteractionMode.moving)
        staticTaskPresenter.redrawBy(task, taskView);
}

export function startTaskMoving<TaskView>(
    taskMatching: repos.MaybeMatchingBy<TaskView, domain.Task>,
    referencePointMatching: repos.MaybeMatchingBy<TaskView, domain.Vector>,
    taskInMotionPresenter: views.DynamicPresenter<TaskView, domain.Task>,
    taskView: TaskView,
    taskMovingControllerMatching: repos.MatchingBy<TaskView, controllers.Controller>,
    x: number,
    y: number,
): void {
    const task = taskMatching.matchedWith(taskView);

    if (task?.mode !== domain.InteractionMode.moving)
        return;

    referencePointMatching.match(taskView, new domain.Vector(x, y));

    taskInMotionPresenter.redrawBy(task, taskView);
    taskMovingControllerMatching.matchedWith(taskView).activate();
}

export function stopTaskMoving<TaskView>(
    taskMatching: repos.MaybeMatchingBy<TaskView, domain.Task>,
    referencePointMatching: repos.MaybeMatchingBy<TaskView, domain.Vector>,
    taskMovingControllerMatching: repos.MatchingBy<TaskView, controllers.Controller>,
    readyToMoveTaskPresenter: views.DynamicPresenter<TaskView, domain.Task>,
    taskView: TaskView,
): void {
    const task = taskMatching.matchedWith(taskView);

    if (task?.mode !== domain.InteractionMode.moving)
        return;

    referencePointMatching.dontMatchWith(taskView);

    taskMovingControllerMatching.matchedWith(taskView).deactivate();
    readyToMoveTaskPresenter.redrawBy(task, taskView);
}

export function moveTask<MapView, TaskView>(
    taskMatching: repos.MaybeMatchingBy<TaskView, domain.Task>,
    referencePointMatching: repos.MaybeMatchingBy<TaskView, domain.Vector>,
    logError: messages.Log,
    fixationTimeout: timeouts.Timeout,
    remoteTasks: remoteRepos.RemoteTasks,
    presenter: views.Presenter<MapView, TaskView, domain.Task>,
    taskView: TaskView,
    x: number,
    y: number,
): void {
    const task = taskMatching.matchedWith(taskView);
    const referencePoint = referencePointMatching.matchedWith(taskView);

    if (task?.mode !== domain.InteractionMode.moving || referencePoint === undefined)
        return;

    const newReferencePoint = new domain.Vector(x, y);
    referencePointMatching.match(taskView, newReferencePoint);

    let taskPosition = new domain.Vector(task.x, task.y);

    const taskMovement = newReferencePoint.of(referencePoint, (v1, v2) => v1 - v2);
    taskPosition = taskPosition.of(taskMovement, (v1, v2) => v1 + v2);

    task.x = taskPosition.x;
    task.y = taskPosition.y;

    presenter.redrawBy(task, taskView);

    fixationTimeout.executeIn(fixationTime, async () => {
        const updatedTask = await remoteTasks.withUpToDatePosition(task);

        if (updatedTask === undefined)
            logError("The remote task position could not be updated");
    });
}

export function handleTaskAddingAvailability<ReadinessAnimationRoot, ReadinessAnimation>(
    pastAvailabilityMatching: repos.MatchingBy<ReadinessAnimation, boolean>,
    descriptionValue: string,
    readinessAnimationRoot: ReadinessAnimationRoot,
    readinessAnimation: ReadinessAnimation,
    readinessAnimationPresenter: views.StaticPresenter<ReadinessAnimationRoot, ReadinessAnimation>,
    startingControllerMatching: repos.MatchingBy<ReadinessAnimation, controllers.Controller>,
): void {
    const description = domain.Description.of(descriptionValue);

    const available = description !== undefined;
    const availableInPast = pastAvailabilityMatching.matchedWith(readinessAnimation);

    pastAvailabilityMatching.match(readinessAnimation, available);

    const controller = startingControllerMatching.matchedWith(readinessAnimation);

    if (available && !availableInPast) {
        readinessAnimationPresenter.drawOn(readinessAnimationRoot, readinessAnimation);
        controller.activate();
    }
    else if (!available && availableInPast) {
        readinessAnimationPresenter.eraseFrom(readinessAnimationRoot, readinessAnimation);
        controller.deactivate();
    }
}

export function startTaskAdding<MapView, ReadinessAnimation, ReadinessAnimationRoot, TaskPrototypeView>(
    pastAvailabilityMatching: repos.MatchingBy<ReadinessAnimation, boolean>,
    mapViewMatching: repos.MaybeMatchingBy<domain.Map, MapView>,
    readinessAnimationRoot: ReadinessAnimationRoot,
    readinessAnimation: ReadinessAnimation,
    readinessAnimationPresenter: views.StaticPresenter<ReadinessAnimationRoot, ReadinessAnimation>,
    taskPrototypeViews: views.Views<TaskPrototypeView>,
    taskPrototypePresenter: views.Presenter<MapView, TaskPrototypeView, domain.TaskPrototype>,
    startingControllerMatching: repos.MatchingBy<ReadinessAnimation, controllers.Controller>,
    continuationControllerMatching: repos.MatchingBy<TaskPrototypeView, controllers.Controller>,
    completionControllerMatching: repos.MatchingBy<TaskPrototypeView, controllers.Controller>,
    descriptionValueContainer: repos.Container<string>,
    getCurrentMap: () => domain.Map,
    taskPrototypeViewMatching: repos.MaybeMatchingBy<MapView, TaskPrototypeView>,
    taskPrototypeMatching: repos.MaybeMatchingBy<TaskPrototypeView, domain.TaskPrototype>,
    x: number,
    y: number,
): void {
    const mapView = mapViewMatching.matchedWith(getCurrentMap());
    const description = domain.Description.of(descriptionValueContainer.get());

    if (mapView === undefined || description === undefined)
        return;

    descriptionValueContainer.set('');

    pastAvailabilityMatching.match(readinessAnimation, false);
    readinessAnimationPresenter.eraseFrom(readinessAnimationRoot, readinessAnimation);
    startingControllerMatching.matchedWith(readinessAnimation).deactivate();

    const taskPrototype: domain.TaskPrototype = {description: description, x: x, y: y};

    const taskPrototypeView = taskPrototypeViews.createEmptyView();
    taskPrototypePresenter.drawOn(mapView, taskPrototypeView);
    taskPrototypePresenter.redrawBy(taskPrototype, taskPrototypeView);

    taskPrototypeViewMatching.match(mapView, taskPrototypeView);
    taskPrototypeMatching.match(taskPrototypeView, taskPrototype);

    continuationControllerMatching.matchedWith(taskPrototypeView).activate();
    completionControllerMatching.matchedWith(taskPrototypeView).activate();
}

export function continueTaskAdding<MapView, TaskPrototypeView>(
    getCurrentMap: () => domain.Map,
    mapViewMatching: repos.MaybeMatchingBy<domain.Map, MapView>,
    taskPrototypeViewMatching: repos.MaybeMatchingBy<MapView, TaskPrototypeView>,
    taskPrototypeMatching: repos.MaybeMatchingBy<TaskPrototypeView, domain.TaskPrototype>,
    taskPrototypePresenter: views.DynamicPresenter<TaskPrototypeView, domain.TaskPrototype>,
    x: number,
    y: number,
): void {
    const mapView = mapViewMatching.matchedWith(getCurrentMap());
    if (mapView === undefined)
        return;

    const taskPrototypeView = taskPrototypeViewMatching.matchedWith(mapView);
    if (taskPrototypeView === undefined)
        return;

    const taskPrototype = taskPrototypeMatching.matchedWith(taskPrototypeView);
    if (taskPrototype === undefined)
        return;

    taskPrototype.x = x;
    taskPrototype.y = y;

    taskPrototypePresenter.redrawBy(taskPrototype, taskPrototypeView);
}

export async function completeTaskAdding<MapView, TaskPrototypeView, TaskView>(
    mapViewMatching: repos.MaybeMatchingBy<domain.Map, MapView>,
    taskPrototypeViewMatching: repos.MaybeMatchingBy<MapView, TaskPrototypeView>,
    taskPrototypeMatching: repos.MaybeMatchingBy<TaskPrototypeView, domain.TaskPrototype>,
    taskPrototypePresenter: views.Presenter<MapView, TaskPrototypeView, domain.TaskPrototype>,
    logError: messages.Log,
    notify: messages.Notify,
    remoteTasks: remoteRepos.RemoteTasks,
    taskViews: views.Views<TaskView>,
    taskPresenter: views.Presenter<MapView, TaskView, domain.Task>,
    taskMatching: repos.MaybeMatchingBy<TaskView, domain.Task>,
    getCurrentMap: () => domain.Map,
    continuationControllerMatching: repos.MatchingBy<TaskPrototypeView, controllers.Controller>,
    completionControllerMatching: repos.MatchingBy<TaskPrototypeView, controllers.Controller>,
    taskControllerMatching: repos.MaybeMatchingBy<TaskView, controllers.Controller[]>,
    taskControllerFactroris: controllers.ControllerFor<TaskView, domain.Task>[],
): Promise<void> {
    const map: domain.Map = getCurrentMap();
    const mapView = mapViewMatching.matchedWith(map);
    if (mapView === undefined)
        return;

    const taskPrototypeView = taskPrototypeViewMatching.matchedWith(mapView);
    if (taskPrototypeView === undefined)
        return;

    const taskPrototype = taskPrototypeMatching.matchedWith(taskPrototypeView);
    if (taskPrototype === undefined)
        return;

    continuationControllerMatching.matchedWith(taskPrototypeView).deactivate();
    completionControllerMatching.matchedWith(taskPrototypeView).deactivate();

    const task = await remoteTasks.createdTaskFrom(taskPrototype, map);

    taskPrototypePresenter.eraseFrom(mapView, taskPrototypeView);

    if (task === undefined) {
        logError(`A remote task on the map with id = ${map.id} could not be created`);
        notify("Try adding your task later");
        return;
    }

    const taskView = taskViews.createEmptyView();
    taskPresenter.drawOn(mapView, taskView);
    taskPresenter.redrawBy(task, taskView);

    const controllers = taskControllerFactroris.map(f => f(taskView, task));
    controllers.forEach(c => c.activate());

    taskMatching.match(taskView, task);
    taskControllerMatching.match(taskView, controllers);
}

import * as facade from "../adapters/out/facade.js";
import * as taskAddingControllers from "../adapters/out/controllers/task-adding.js";
import * as taskMovingControllers from "../adapters/out/controllers/task-moving.js";
import * as taskControllers from "../adapters/out/controllers/tasks.js";

const taskControllerFactories = [
    taskControllers.modeChangingControllerFor,
    taskControllers.descriptionChangingControllerFor,
    taskMovingControllers.preparationControllerFor,
    taskMovingControllers.startingControllerFor,
    taskMovingControllers.stoppingControllerFor,
    taskMovingControllers.cancellationControllerFor,
];

facade.drawMap(
    document.body,
    <HTMLTextAreaElement>document.querySelector("#new-task-description"),
    view => taskAddingControllers.availabilityControllerFor(
        view,
        document.body,
        taskControllerFactories,
    ),
    taskControllerFactories,
);

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import tasksRouter from "./tasks";
import chatRouter from "./chat";
import sessionsRouter from "./sessions";
import xpRouter from "./xp";
import charactersRouter from "./characters";
import behaviorRouter from "./behavior";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(tasksRouter);
router.use(chatRouter);
router.use(sessionsRouter);
router.use(xpRouter);
router.use(charactersRouter);
router.use(behaviorRouter);

export default router;

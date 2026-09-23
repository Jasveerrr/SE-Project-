import { Router } from "express";
import { PairingController } from "../controllers/PairingController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

export const pairingRoutes = Router();

pairingRoutes.use(authMiddleware);

pairingRoutes.post("/pairings/request", PairingController.sendPairingRequest);
pairingRoutes.post("/pairings/accept", PairingController.acceptPairingRequest);
pairingRoutes.post("/pairings/reject", PairingController.rejectPairingRequest);
pairingRoutes.post("/pairings/cancel", PairingController.cancelPairingRequest);
pairingRoutes.get("/pairings/:pairingId", PairingController.getPairingStatus);

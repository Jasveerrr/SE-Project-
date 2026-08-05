import { Router } from "express";
import { PairingController } from "../controllers/PairingController.js";

export const pairingRoutes = Router();

pairingRoutes.post("/pairings/request", PairingController.sendPairingRequest);
pairingRoutes.post("/pairings/accept", PairingController.acceptPairingRequest);
pairingRoutes.post("/pairings/reject", PairingController.rejectPairingRequest);
pairingRoutes.get("/pairings/:pairingId", PairingController.getPairingStatus);

import { Router } from "express";
import { TransferController } from "../controllers/TransferController.js";

export const transferRoutes = Router();

transferRoutes.post("/transfers", TransferController.startTransfer);
transferRoutes.get("/transfers", TransferController.getTransfers);
transferRoutes.get("/transfers/:transferId", TransferController.getTransfer);
transferRoutes.put("/transfers/:transferId", TransferController.updateTransfer);
transferRoutes.patch("/transfers/:transferId/cancel", TransferController.cancelTransfer);
transferRoutes.patch("/transfers/:transferId/complete", TransferController.completeTransfer);
transferRoutes.delete("/transfers/:transferId", TransferController.deleteTransfer);

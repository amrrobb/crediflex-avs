import { monitorNewTasks } from "./operator";
import Moralis from "moralis";
import * as dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const PORT: number = 3000;

app.use(express.json()); // Middleware to parse JSON payloads

// Start the server and monitor tasks on server startup
app.listen(PORT, async () => {
	console.log(`Server is running on http://localhost:${PORT}`);
	monitorNewTasks(); // Start monitoring when the server starts
});

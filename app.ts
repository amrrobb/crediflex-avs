import { processNewTasksByLastEvent } from "./operator";
import * as dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const PORT: number = 3000;

app.use(express.json()); // Middleware to parse JSON payloads

app.get("/", (_, res) => {
	res.send("Welcome to Crediflex AVS!");
});

app.get("/process", async (_, res) => {
	await processNewTasksByLastEvent();
	res.send("Data processed successfully");
});

// Start the server and monitor tasks on server startup
app.listen(PORT, async () => {
	console.log(`Server is running on http://localhost:${PORT}`);
	// monitorNewTasks(); // Start monitoring when the server starts
});

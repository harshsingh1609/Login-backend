import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "./generated/prisma/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

app.get("/health", (req, res) => {
	return res.json({ status: "ok" });
});

app.post("/api/auth/signup", async (req, res) => {
	try {
		const { email, password, name, role: rawRole } = req.body;
		if (!email || !password) {
			return res.status(400).json({ message: "email and password are required" });
		}

		function normalizeRole(input) {
			if (!input) return null;
			const value = String(input).trim().toUpperCase();
			if (value === "ADMINISTRATOR") return "OFFICIAL";
			if (value === "ADMIN") return "ADMIN";
			if (value === "STUDENT") return "STUDENT";
			if (value === "OFFICIAL") return "OFFICIAL";
			return null;
		}

		const role = normalizeRole(rawRole);
		if (!role) {
			return res.status(400).json({ message: "invalid or missing role; expected ADMIN, STUDENT, or OFFICIAL" });
		}
		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) {
			return res.status(409).json({ message: "Email already registered" });
		}
		const passwordHash = await bcrypt.hash(password, 10);
		const created = await prisma.$transaction(async (tx) => {
			const user = await tx.user.create({ data: { email, passwordHash, name, role } });
			if (role === "ADMIN") {
				await tx.admin.create({ data: { userId: user.id } });
			} else if (role === "STUDENT") {
				await tx.student.create({ data: { userId: user.id } });
			} else if (role === "OFFICIAL") {
				await tx.official.create({ data: { userId: user.id } });
			}
			return user;
		});
		return res.status(201).json({ id: created.id, email: created.email, name: created.name, role: created.role });
	} catch (err) {
		return res.status(500).json({ message: "Internal server error" });
	}
});

app.post("/api/auth/login", async (req, res) => {
	try {
		const { email, password } = req.body;
		if (!email || !password) {
			return res.status(400).json({ message: "email and password are required" });
		}
		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) {
			return res.status(401).json({ message: "Invalid credentials" });
		}
		const valid = await bcrypt.compare(password, user.passwordHash);
		if (!valid) {
			return res.status(401).json({ message: "Invalid credentials" });
		}
		const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
		return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
	} catch (err) {
		return res.status(500).json({ message: "Internal server error" });
	}
});

function authMiddleware(req, res, next) {
	const authHeader = req.headers.authorization || "";
	const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
	if (!token) return res.status(401).json({ message: "Missing token" });
	try {
		const payload = jwt.verify(token, JWT_SECRET);
		req.user = payload;
		return next();
	} catch {
		return res.status(401).json({ message: "Invalid token" });
	}
}

app.get("/api/me", authMiddleware, async (req, res) => {
	const me = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { id: true, email: true, name: true, role: true } });
	return res.json(me);
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
	console.log(`Auth server listening on port ${PORT}`);
});




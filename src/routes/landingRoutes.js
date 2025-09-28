import express from "express";
import { getLandingPageData, getSearchSuggestions } from "../controllers/landingController.js";

const router = express.Router();

// Get landing page data (properties + metrics)
router.get("/", getLandingPageData);

// Get search suggestions for autocomplete
router.get("/search-suggestions", getSearchSuggestions);

export default router;
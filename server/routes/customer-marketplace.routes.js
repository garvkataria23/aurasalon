import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { publicBookingRateLimit } from "../middleware/public-booking-rate-limit.middleware.js";
import { customerMarketplaceService } from "../services/customer-marketplace.service.js";

export const customerMarketplaceRouter = Router();

customerMarketplaceRouter.use("/public", publicBookingRateLimit({ max: 120, windowMs: 60_000 }));

customerMarketplaceRouter.get(
  "/public/businesses",
  asyncHandler((req, res) => {
    res.json(customerMarketplaceService.listBusinesses(req.query));
  })
);

customerMarketplaceRouter.get(
  "/public/search",
  asyncHandler((req, res) => {
    res.json(customerMarketplaceService.listBusinesses(req.query));
  })
);

customerMarketplaceRouter.get(
  "/public/categories",
  asyncHandler((_req, res) => {
    res.json(customerMarketplaceService.categories());
  })
);

customerMarketplaceRouter.get(
  "/public/membership-plans",
  asyncHandler((req, res) => {
    res.json(customerMarketplaceService.membershipPlans({ branchId: req.query.branchId || "" }));
  })
);

customerMarketplaceRouter.get(
  "/public/businesses/:slug",
  asyncHandler((req, res) => {
    res.json(customerMarketplaceService.business(req.params.slug));
  })
);

customerMarketplaceRouter.get(
  "/public/businesses/:slug/services",
  asyncHandler((req, res) => {
    res.json(customerMarketplaceService.services(req.params.slug));
  })
);

customerMarketplaceRouter.get(
  "/public/businesses/:slug/staff",
  asyncHandler((req, res) => {
    res.json(customerMarketplaceService.staff(req.params.slug));
  })
);

customerMarketplaceRouter.get(
  "/public/businesses/:slug/reviews",
  asyncHandler((req, res) => {
    res.json(customerMarketplaceService.reviews(req.params.slug));
  })
);

customerMarketplaceRouter.get(
  "/public/businesses/:slug/availability",
  asyncHandler((req, res) => {
    res.json(customerMarketplaceService.availability(req.params.slug, req.query));
  })
);

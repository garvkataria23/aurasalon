import { Injectable } from '@angular/core';

export type SalonSceneModeId = 'lounge' | 'stations' | 'retail';

export interface SalonMetric {
  label: string;
  value: string;
  detail: string;
}

export interface SalonServiceItem {
  name: string;
  duration: string;
  price: string;
  detail: string;
}

export interface SalonExperienceZone {
  title: string;
  detail: string;
  signal: string;
}

export interface SalonSceneMode {
  id: SalonSceneModeId;
  label: string;
  camera: readonly [number, number, number];
  lookAt: readonly [number, number, number];
}

export interface SalonWebsiteContent {
  hero: {
    eyebrow: string;
    brandName: string;
    summary: string;
    bookingWindow: string;
    phone: string;
    whatsappLink: string;
  };
  metrics: readonly SalonMetric[];
  services: readonly SalonServiceItem[];
  zones: readonly SalonExperienceZone[];
  sceneModes: readonly SalonSceneMode[];
  branches: readonly string[];
}

const SALON_WEBSITE_CONTENT: SalonWebsiteContent = {
  hero: {
    eyebrow: '3D salon website',
    brandName: 'AuraShine Luxe Salon',
    summary: 'A premium appointment-first salon website with an interactive 3D studio, service menu, branch presence and direct booking flow.',
    bookingWindow: 'Open today 10:00 AM to 8:30 PM',
    phone: '+91 90000 55555',
    whatsappLink: 'https://wa.me/919000055555?text=Hi%20AuraShine%2C%20I%20want%20to%20book%20a%20salon%20appointment'
  },
  metrics: [
    { label: 'Guest rating', value: '4.9', detail: 'from verified visits' },
    { label: 'Premium stations', value: '12', detail: 'hair, skin and styling' },
    { label: 'Average ritual', value: '85 min', detail: 'consultation to finish' },
    { label: 'Branches', value: '3', detail: 'multi-city ready' }
  ],
  services: [
    { name: 'Signature Hair Spa', duration: '75 min', price: 'INR 2,400', detail: 'Scalp diagnosis, steam therapy and shine finish.' },
    { name: 'Bridal Glow Suite', duration: '120 min', price: 'INR 6,500', detail: 'Skin prep, makeup trial notes and artist assignment.' },
    { name: 'Color Correction Atelier', duration: '150 min', price: 'INR 7,800', detail: 'Patch-safe consultation, strand mapping and toner plan.' },
    { name: 'Men Grooming Studio', duration: '45 min', price: 'INR 1,250', detail: 'Cut, beard sculpt, cleanse and styling product match.' },
    { name: 'Nail and Lash Bar', duration: '60 min', price: 'INR 1,900', detail: 'Hygienic stations, shade curation and aftercare notes.' },
    { name: 'Membership Refresh', duration: '50 min', price: 'INR 999', detail: 'Monthly express service for active AuraShine members.' }
  ],
  zones: [
    { title: 'Consultation lounge', detail: 'Guest profile, allergies, preferences and service history captured before every visit.', signal: 'CRM ready' },
    { title: 'Styling stations', detail: 'Multi-staff, multi-service scheduling with visible chair allocation and timing discipline.', signal: 'Booking ready' },
    { title: 'Retail edit', detail: 'Product shelves connect service recommendations with inventory, billing and WhatsApp follow-up.', signal: 'POS ready' }
  ],
  sceneModes: [
    { id: 'lounge', label: 'Lounge', camera: [0, 3.1, 8.8], lookAt: [0, 1.25, -0.4] },
    { id: 'stations', label: 'Stations', camera: [-4.9, 2.9, 5.8], lookAt: [-1.7, 1.25, -2.5] },
    { id: 'retail', label: 'Retail', camera: [4.8, 2.8, 5.4], lookAt: [2.6, 1.35, -2.1] }
  ],
  branches: ['Mumbai Flagship', 'Delhi Studio', 'Bengaluru Lounge']
};

@Injectable({ providedIn: 'root' })
export class SalonWebsiteContentService {
  content(): SalonWebsiteContent {
    return SALON_WEBSITE_CONTENT;
  }
}

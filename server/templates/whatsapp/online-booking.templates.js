const commonFooter = {
  en: "Reply STOP to opt out.",
  hi: "STOP reply karke opt out kar sakte hain.",
  "hi-en": "STOP reply karke opt out kar sakte hain.",
  mr: "STOP reply karun opt out kara.",
  gu: "STOP reply kari opt out karo.",
  ta: "STOP reply seithu opt out seiyalam.",
  bn: "STOP reply kore opt out korte paren."
};

function pack(lines) {
  return Object.fromEntries(Object.entries(lines).map(([language, body]) => [language, `${body} ${commonFooter[language] || commonFooter.en}`]));
}

export const onlineBookingWhatsappTemplates = {
  otp_send: pack({
    en: "Hi {{client_name}}, your {{salon_name}} booking OTP is {{otp}}. It expires in 5 minutes.",
    hi: "Namaste {{client_name}}, {{salon_name}} booking OTP {{otp}} hai. Ye 5 minute me expire hoga.",
    "hi-en": "Hi {{client_name}}, aapka {{salon_name}} booking OTP {{otp}} hai. 5 minutes me expire hoga.",
    mr: "Namaskar {{client_name}}, {{salon_name}} booking OTP {{otp}} aahe. To 5 minutes madhye expire hoil.",
    gu: "Namaste {{client_name}}, {{salon_name}} booking OTP {{otp}} chhe. 5 minute ma expire thashe.",
    ta: "Vanakkam {{client_name}}, {{salon_name}} booking OTP {{otp}}. 5 nimidathil expire aagum.",
    bn: "Nomoskar {{client_name}}, {{salon_name}} booking OTP {{otp}}. 5 minute e expire hobe."
  }),
  booking_confirmation: pack({
    en: "Hi {{client_name}}, your {{service_name}} appointment on {{date}} at {{time}} with {{staff_name}} at {{salon_name}} ({{branch_name}}) is confirmed. Booking ID: {{booking_id}}.",
    hi: "Namaste {{client_name}}, {{service_name}} ki appointment {{date}} {{time}} par {{staff_name}} ke saath {{salon_name}} ({{branch_name}}) me confirm hai. Booking ID: {{booking_id}}.",
    "hi-en": "Hi {{client_name}}, aapki {{service_name}} booking {{date}} {{time}} pe {{staff_name}} ke saath {{salon_name}} ({{branch_name}}) me confirm ho gayi hai. Booking ID: {{booking_id}}.",
    mr: "Namaskar {{client_name}}, {{service_name}} appointment {{date}} {{time}} la {{staff_name}} sobat {{salon_name}} ({{branch_name}}) yethe confirm aahe. Booking ID: {{booking_id}}.",
    gu: "Namaste {{client_name}}, {{service_name}} appointment {{date}} {{time}} e {{staff_name}} sathe {{salon_name}} ({{branch_name}}) ma confirm chhe. Booking ID: {{booking_id}}.",
    ta: "Vanakkam {{client_name}}, {{service_name}} appointment {{date}} {{time}} ku {{staff_name}} udan {{salon_name}} ({{branch_name}}) il confirm aagiyathu. Booking ID: {{booking_id}}.",
    bn: "Nomoskar {{client_name}}, {{service_name}} appointment {{date}} {{time}} e {{staff_name}} er sathe {{salon_name}} ({{branch_name}}) e confirm hoyeche. Booking ID: {{booking_id}}."
  }),
  deposit_link: pack({
    en: "Hi {{client_name}}, please pay the booking deposit of INR {{deposit_amount}} for {{service_name}}: {{payment_link}}.",
    hi: "Namaste {{client_name}}, {{service_name}} ke liye INR {{deposit_amount}} deposit pay karein: {{payment_link}}.",
    "hi-en": "Hi {{client_name}}, {{service_name}} ke liye INR {{deposit_amount}} booking deposit pay karein: {{payment_link}}.",
    mr: "Namaskar {{client_name}}, {{service_name}} sathi INR {{deposit_amount}} deposit pay kara: {{payment_link}}.",
    gu: "Namaste {{client_name}}, {{service_name}} mate INR {{deposit_amount}} deposit pay karo: {{payment_link}}.",
    ta: "Vanakkam {{client_name}}, {{service_name}} booking deposit INR {{deposit_amount}} pay seiyavum: {{payment_link}}.",
    bn: "Nomoskar {{client_name}}, {{service_name}} er jonno INR {{deposit_amount}} deposit pay korun: {{payment_link}}."
  }),
  payment_failed_recovery: pack({
    en: "Hi {{client_name}}, your payment did not complete. You can retry here: {{payment_link}}.",
    hi: "Namaste {{client_name}}, payment complete nahi hua. Yahan retry karein: {{payment_link}}.",
    "hi-en": "Hi {{client_name}}, payment complete nahi hua. Yahan retry karein: {{payment_link}}.",
    mr: "Namaskar {{client_name}}, payment complete jhale nahi. Ithe retry kara: {{payment_link}}.",
    gu: "Namaste {{client_name}}, payment complete thayu nathi. Ahithi retry karo: {{payment_link}}.",
    ta: "Vanakkam {{client_name}}, payment mudiyavillai. Inge retry seiyavum: {{payment_link}}.",
    bn: "Nomoskar {{client_name}}, payment complete hoyni. Ekhane retry korun: {{payment_link}}."
  }),
  reminder_24h: pack({
    en: "Hi {{client_name}}, reminder: your {{service_name}} appointment is tomorrow at {{time}}.",
    hi: "Namaste {{client_name}}, reminder: aapki {{service_name}} appointment kal {{time}} par hai.",
    "hi-en": "Hi {{client_name}}, reminder: aapki {{service_name}} appointment kal {{time}} pe hai.",
    mr: "Namaskar {{client_name}}, reminder: tumchi {{service_name}} appointment udya {{time}} la aahe.",
    gu: "Namaste {{client_name}}, reminder: tamari {{service_name}} appointment kale {{time}} e chhe.",
    ta: "Vanakkam {{client_name}}, reminder: ungal {{service_name}} appointment naalai {{time}} ku ullathu.",
    bn: "Nomoskar {{client_name}}, reminder: apnar {{service_name}} appointment kal {{time}} e."
  }),
  reminder_2h: pack({
    en: "Hi {{client_name}}, your {{service_name}} appointment starts in about 2 hours at {{branch_name}}.",
    hi: "Namaste {{client_name}}, {{branch_name}} me aapki {{service_name}} appointment lagbhag 2 ghante me hai.",
    "hi-en": "Hi {{client_name}}, {{branch_name}} me aapki {{service_name}} appointment around 2 hours me hai.",
    mr: "Namaskar {{client_name}}, {{branch_name}} yethe {{service_name}} appointment sadharan 2 tasat aahe.",
    gu: "Namaste {{client_name}}, {{branch_name}} ma {{service_name}} appointment lagbhag 2 kalak ma chhe.",
    ta: "Vanakkam {{client_name}}, {{branch_name}} il {{service_name}} appointment 2 mani nerathil ullathu.",
    bn: "Nomoskar {{client_name}}, {{branch_name}} e {{service_name}} appointment pray 2 ghonta pore."
  }),
  cancellation_confirmation: pack({
    en: "Hi {{client_name}}, your booking {{booking_id}} has been cancelled. Reason: {{reason}}.",
    hi: "Namaste {{client_name}}, booking {{booking_id}} cancel ho gayi hai. Reason: {{reason}}.",
    "hi-en": "Hi {{client_name}}, booking {{booking_id}} cancel ho gayi hai. Reason: {{reason}}.",
    mr: "Namaskar {{client_name}}, booking {{booking_id}} cancel zali aahe. Reason: {{reason}}.",
    gu: "Namaste {{client_name}}, booking {{booking_id}} cancel thai chhe. Reason: {{reason}}.",
    ta: "Vanakkam {{client_name}}, booking {{booking_id}} cancel aagiyathu. Reason: {{reason}}.",
    bn: "Nomoskar {{client_name}}, booking {{booking_id}} cancel hoyeche. Reason: {{reason}}."
  }),
  cancellation_with_refund: pack({
    en: "Hi {{client_name}}, booking {{booking_id}} is cancelled. Refund status: {{refund_status}}.",
    hi: "Namaste {{client_name}}, booking {{booking_id}} cancel hai. Refund status: {{refund_status}}.",
    "hi-en": "Hi {{client_name}}, booking {{booking_id}} cancel hai. Refund status: {{refund_status}}.",
    mr: "Namaskar {{client_name}}, booking {{booking_id}} cancel aahe. Refund status: {{refund_status}}.",
    gu: "Namaste {{client_name}}, booking {{booking_id}} cancel chhe. Refund status: {{refund_status}}.",
    ta: "Vanakkam {{client_name}}, booking {{booking_id}} cancel. Refund status: {{refund_status}}.",
    bn: "Nomoskar {{client_name}}, booking {{booking_id}} cancel. Refund status: {{refund_status}}."
  }),
  reschedule_link: pack({
    en: "Hi {{client_name}}, reschedule your booking {{booking_id}} here: {{reschedule_link}}.",
    hi: "Namaste {{client_name}}, booking {{booking_id}} reschedule karne ke liye: {{reschedule_link}}.",
    "hi-en": "Hi {{client_name}}, booking {{booking_id}} reschedule karne ke liye: {{reschedule_link}}.",
    mr: "Namaskar {{client_name}}, booking {{booking_id}} reschedule kara: {{reschedule_link}}.",
    gu: "Namaste {{client_name}}, booking {{booking_id}} reschedule karo: {{reschedule_link}}.",
    ta: "Vanakkam {{client_name}}, booking {{booking_id}} reschedule seiyavum: {{reschedule_link}}.",
    bn: "Nomoskar {{client_name}}, booking {{booking_id}} reschedule korun: {{reschedule_link}}."
  }),
  reschedule_confirmation: pack({
    en: "Hi {{client_name}}, your booking {{booking_id}} is rescheduled to {{date}} at {{time}}.",
    hi: "Namaste {{client_name}}, booking {{booking_id}} ab {{date}} {{time}} par reschedule hai.",
    "hi-en": "Hi {{client_name}}, booking {{booking_id}} ab {{date}} {{time}} pe reschedule hai.",
    mr: "Namaskar {{client_name}}, booking {{booking_id}} {{date}} {{time}} la reschedule aahe.",
    gu: "Namaste {{client_name}}, booking {{booking_id}} {{date}} {{time}} e reschedule chhe.",
    ta: "Vanakkam {{client_name}}, booking {{booking_id}} {{date}} {{time}} ku reschedule aagiyathu.",
    bn: "Nomoskar {{client_name}}, booking {{booking_id}} {{date}} {{time}} e reschedule hoyeche."
  }),
  waitlist_slot_available: pack({
    en: "Hi {{client_name}}, a slot is available for {{service_name}} at {{time}}. Reply BOOK to reserve.",
    hi: "Namaste {{client_name}}, {{service_name}} ke liye {{time}} par slot available hai. Reserve ke liye BOOK reply karein.",
    "hi-en": "Hi {{client_name}}, {{service_name}} ke liye {{time}} pe slot available hai. BOOK reply karein.",
    mr: "Namaskar {{client_name}}, {{service_name}} sathi {{time}} la slot available aahe. BOOK reply kara.",
    gu: "Namaste {{client_name}}, {{service_name}} mate {{time}} e slot available chhe. BOOK reply karo.",
    ta: "Vanakkam {{client_name}}, {{service_name}} ku {{time}} slot available. BOOK reply seiyavum.",
    bn: "Nomoskar {{client_name}}, {{service_name}} er jonno {{time}} slot available. BOOK reply korun."
  }),
  abandoned_cart_recovery: pack({
    en: "Hi {{client_name}}, you left your {{service_name}} booking incomplete. Continue here: {{resume_link}}.",
    hi: "Namaste {{client_name}}, aapki {{service_name}} booking incomplete reh gayi. Yahan continue karein: {{resume_link}}.",
    "hi-en": "Hi {{client_name}}, aapki {{service_name}} booking incomplete reh gayi. Continue here: {{resume_link}}.",
    mr: "Namaskar {{client_name}}, tumchi {{service_name}} booking incomplete rahili. Ithe continue kara: {{resume_link}}.",
    gu: "Namaste {{client_name}}, tamari {{service_name}} booking incomplete rahi. Ahithi continue karo: {{resume_link}}.",
    ta: "Vanakkam {{client_name}}, ungal {{service_name}} booking incomplete. Inge continue seiyavum: {{resume_link}}.",
    bn: "Nomoskar {{client_name}}, apnar {{service_name}} booking incomplete. Ekhane continue korun: {{resume_link}}."
  }),
  no_show_followup: pack({
    en: "Hi {{client_name}}, we missed you today. Reply RESCHEDULE and we will help find a new slot.",
    hi: "Namaste {{client_name}}, aaj aap nahi aa paye. RESCHEDULE reply karein, hum new slot find karenge.",
    "hi-en": "Hi {{client_name}}, aaj aap nahi aa paye. RESCHEDULE reply karein, hum new slot help karenge.",
    mr: "Namaskar {{client_name}}, aaj tumhi yeu shakla nahi. RESCHEDULE reply kara.",
    gu: "Namaste {{client_name}}, tame aaje avi na shakya. RESCHEDULE reply karo.",
    ta: "Vanakkam {{client_name}}, neengal indru varavillai. RESCHEDULE reply seiyavum.",
    bn: "Nomoskar {{client_name}}, aj apni ashte parenni. RESCHEDULE reply korun."
  }),
  feedback_request: pack({
    en: "Hi {{client_name}}, how was your {{service_name}} visit? Share feedback here: {{feedback_link}}.",
    hi: "Namaste {{client_name}}, aapka {{service_name}} visit kaisa raha? Feedback dein: {{feedback_link}}.",
    "hi-en": "Hi {{client_name}}, aapka {{service_name}} visit kaisa raha? Feedback dein: {{feedback_link}}.",
    mr: "Namaskar {{client_name}}, tumcha {{service_name}} visit kasa hota? Feedback dya: {{feedback_link}}.",
    gu: "Namaste {{client_name}}, tamaro {{service_name}} visit kevo hato? Feedback aapo: {{feedback_link}}.",
    ta: "Vanakkam {{client_name}}, ungal {{service_name}} visit epadi irundhathu? Feedback: {{feedback_link}}.",
    bn: "Nomoskar {{client_name}}, apnar {{service_name}} visit kemon chilo? Feedback din: {{feedback_link}}."
  }),
  rebooking_recommendation: pack({
    en: "Hi {{client_name}}, it may be time for your next {{service_name}}. Suggested date: {{suggested_date}}.",
    hi: "Namaste {{client_name}}, aapke next {{service_name}} ka time ho sakta hai. Suggested date: {{suggested_date}}.",
    "hi-en": "Hi {{client_name}}, next {{service_name}} ka time ho sakta hai. Suggested date: {{suggested_date}}.",
    mr: "Namaskar {{client_name}}, pudhcha {{service_name}} karanyachi vel asu shakate. Suggested date: {{suggested_date}}.",
    gu: "Namaste {{client_name}}, next {{service_name}} no samay thayel hoy shake. Suggested date: {{suggested_date}}.",
    ta: "Vanakkam {{client_name}}, next {{service_name}} seiya neram irukkalam. Suggested date: {{suggested_date}}.",
    bn: "Nomoskar {{client_name}}, next {{service_name}} er somoy hote pare. Suggested date: {{suggested_date}}."
  }),
  touchup_eligibility_reminder: pack({
    en: "Hi {{client_name}}, your {{service_name}} touch-up warranty is active until {{warranty_until}}.",
    hi: "Namaste {{client_name}}, {{service_name}} touch-up warranty {{warranty_until}} tak active hai.",
    "hi-en": "Hi {{client_name}}, {{service_name}} touch-up warranty {{warranty_until}} tak active hai.",
    mr: "Namaskar {{client_name}}, {{service_name}} touch-up warranty {{warranty_until}} paryant active aahe.",
    gu: "Namaste {{client_name}}, {{service_name}} touch-up warranty {{warranty_until}} sudhi active chhe.",
    ta: "Vanakkam {{client_name}}, {{service_name}} touch-up warranty {{warranty_until}} varai active.",
    bn: "Nomoskar {{client_name}}, {{service_name}} touch-up warranty {{warranty_until}} porjonto active."
  }),
  birthday_offer: pack({
    en: "Happy birthday {{client_name}}! {{salon_name}} has a special birthday offer waiting for you.",
    hi: "Happy birthday {{client_name}}! {{salon_name}} me aapke liye special birthday offer hai.",
    "hi-en": "Happy birthday {{client_name}}! {{salon_name}} me aapke liye special birthday offer hai.",
    mr: "Happy birthday {{client_name}}! {{salon_name}} kade tumchya sathi special offer aahe.",
    gu: "Happy birthday {{client_name}}! {{salon_name}} ma tamara mate special offer chhe.",
    ta: "Happy birthday {{client_name}}! {{salon_name}} il special birthday offer ullathu.",
    bn: "Happy birthday {{client_name}}! {{salon_name}} e apnar jonno special offer ache."
  }),
  tier_upgrade_notification: pack({
    en: "Hi {{client_name}}, congratulations! You are now {{tier_name}} tier at {{salon_name}}.",
    hi: "Namaste {{client_name}}, congratulations! Aap ab {{salon_name}} me {{tier_name}} tier par hain.",
    "hi-en": "Hi {{client_name}}, congratulations! Aap ab {{salon_name}} me {{tier_name}} tier par hain.",
    mr: "Namaskar {{client_name}}, congratulations! Tumhi ata {{salon_name}} madhye {{tier_name}} tier var aahat.",
    gu: "Namaste {{client_name}}, congratulations! Tame have {{salon_name}} ma {{tier_name}} tier par cho.",
    ta: "Vanakkam {{client_name}}, congratulations! Neengal {{salon_name}} il {{tier_name}} tier.",
    bn: "Nomoskar {{client_name}}, congratulations! Apni ekhon {{salon_name}} e {{tier_name}} tier."
  })
};

export const supportedBookingTemplateLanguages = ["en", "hi", "hi-en", "mr", "gu", "ta", "bn"];

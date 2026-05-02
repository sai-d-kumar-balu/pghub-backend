const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const OwnerProfile = require("../models/OwnerProfile");
const PgProperty = require("../models/PgProperty");
const Bed = require("../models/Bed");
const Booking = require("../models/Booking");
const Payment = require("../models/Payment");
const RentCycle = require("../models/RentCycle");
const Ticket = require("../models/Ticket");
const AuditLog = require("../models/AuditLog");
const SavedPaymentMethod = require("../models/SavedPaymentMethod");
const PlatformConfig = require("../models/PlatformConfig");

async function clearCollections() {
  await Promise.all([
    User.deleteMany({}),
    OwnerProfile.deleteMany({}),
    PgProperty.deleteMany({}),
    Bed.deleteMany({}),
    Booking.deleteMany({}),
    Payment.deleteMany({}),
    RentCycle.deleteMany({}),
    Ticket.deleteMany({}),
    AuditLog.deleteMany({}),
    SavedPaymentMethod.deleteMany({}),
    PlatformConfig.deleteMany({}),
  ]);
}

async function seed() {
  await connectDB();
  await clearCollections();

  const passwordHash = await bcrypt.hash("Pass@123", 10);

  const [admin, ownerOne, ownerTwo, ownerPending, tenantOne, tenantTwo, tenantThree] = await User.create([
    {
      name: "PGHub Admin",
      phone: "9000000001",
      email: "admin@pghub.com",
      passwordHash,
      role: "ADMIN",
      gender: "OTHER",
    },
    {
      name: "Sai Owner",
      phone: "9000000002",
      email: "owner@pghub.com",
      passwordHash,
      role: "OWNER",
      gender: "MALE",
    },
    {
      name: "Nisha Owner",
      phone: "9000000005",
      email: "nisha-owner@pghub.com",
      passwordHash,
      role: "OWNER",
      gender: "FEMALE",
    },
    {
      name: "Arun Pending KYC",
      phone: "9000000007",
      email: "arun-pending@pghub.com",
      passwordHash,
      role: "OWNER",
      gender: "MALE",
    },
    {
      name: "Rahul Tenant",
      phone: "9000000003",
      email: "rahul@pghub.com",
      passwordHash,
      role: "USER",
      gender: "MALE",
      profession: "Software Engineer",
      address: "HSR Layout, Bangalore",
      emergencyContactName: "Ramesh",
      emergencyContactPhone: "9876543210",
    },
    {
      name: "Ananya Tenant",
      phone: "9000000004",
      email: "ananya@pghub.com",
      passwordHash,
      role: "USER",
      gender: "FEMALE",
      profession: "Product Designer",
      address: "Koramangala, Bangalore",
      emergencyContactName: "Suresh",
      emergencyContactPhone: "9876501234",
    },
    {
      name: "Kiran Tenant",
      phone: "9000000006",
      email: "kiran@pghub.com",
      passwordHash,
      role: "USER",
      gender: "MALE",
      status: "BLOCKED",
    },
  ]);

  await OwnerProfile.create([
    {
      userId: ownerOne._id,
      kycStatus: "VERIFIED",
      pan: "ABCDE1234F",
      aadhaar: "123412341234",
      gstNumber: "29ABCDE1234F1Z5",
      bankDetails: {
        accountHolderName: ownerOne.name,
        accountNumber: "123456789012",
        ifsc: "HDFC0001234",
        upiId: "owner@upi",
      },
      commissionPct: 10,
    },
    {
      userId: ownerTwo._id,
      kycStatus: "VERIFIED",
      pan: "PQRSX6789K",
      aadhaar: "567856785678",
      gstNumber: "29PQRSX6789K1Z1",
      bankDetails: {
        accountHolderName: ownerTwo.name,
        accountNumber: "567890123456",
        ifsc: "ICIC0004321",
        upiId: "nisha@upi",
      },
      commissionPct: 8,
    },
    {
      userId: ownerPending._id,
      kycStatus: "PENDING",
      pan: "XXXXX0000X",
      aadhaar: "",
      bankDetails: {
        accountHolderName: ownerPending.name,
        accountNumber: "",
        ifsc: "",
        upiId: "",
      },
      commissionPct: 10,
    },
  ]);

  const [pgOne, pgTwo, pgThree] = await PgProperty.create([
    {
      ownerId: ownerOne._id,
      name: "Koramangala Prime Stay",
      propertyType: "COLIVING",
      location: { lat: 12.9352, lng: 77.6245 },
      address: "5th Block, Koramangala",
      city: "Bangalore",
      verified: true,
      status: "ACTIVE",
      amenities: ["WiFi", "AC", "Laundry", "Food", "Housekeeping", "Hot water"],
      images: [
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80",
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=80",
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=80",
      ],
      foodMenu: {
        morning: "Idli & sambar, bread & jam, tea/coffee (7:30–9:30 AM). South Indian veg.",
        evening: "Rice, dal, seasonal veg curry, pickle, salad (7:30–9:00 PM).",
        night: "Milk & biscuits or light soup (10:00 PM).",
      },
    },
    {
      ownerId: ownerOne._id,
      name: "HSR Elite Homes",
      propertyType: "GENTS",
      location: { lat: 12.9121, lng: 77.6446 },
      address: "Sector 2, HSR Layout",
      city: "Bangalore",
      verified: true,
      status: "ACTIVE",
      amenities: ["WiFi", "Gym", "Power Backup", "Parking", "RO water"],
      images: [
        "https://images.unsplash.com/photo-1493809842364-78817dbbbf1f?w=1200&q=80",
        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=80",
      ],
      foodMenu: {
        morning: "Optional breakfast add-on: poha/upma (order day before). Tea on request.",
        evening: "No mess — kitchenette access. Nearby eateries listed at reception.",
        night: "—",
      },
    },
    {
      ownerId: ownerTwo._id,
      name: "Indiranagar Aura Ladies PG",
      propertyType: "LADIES",
      location: { lat: 12.9719, lng: 77.6412 },
      address: "100 Feet Road, Indiranagar",
      city: "Bangalore",
      verified: false,
      status: "ACTIVE",
      amenities: ["WiFi", "Laundry", "CCTV", "Food", "Biometric entry"],
      images: [
        "https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=1200&q=80",
        "https://images.unsplash.com/photo-1556020682-ae6a7f23a501?w=1200&q=80",
      ],
      foodMenu: {
        morning: "Paratha, curd, chai (8:00–9:30 AM).",
        evening: "North & South thali rotation — rice, roti, sabzi, dal (8:00–9:30 PM).",
        night: "Fruit or warm milk (9:30 PM).",
      },
    },
  ]);

  const beds = await Bed.create([
    {
      pgId: pgOne._id,
      roomNo: "101",
      bedNo: "A",
      sharingType: 3,
      genderTag: "MALE",
      ac: true,
      attachedBath: true,
      status: "OCCUPIED",
      priceMonthly: 11500,
      tenantUserId: tenantOne._id,
    },
    {
      pgId: pgOne._id,
      roomNo: "101",
      bedNo: "B",
      sharingType: 3,
      genderTag: "MALE",
      ac: true,
      attachedBath: true,
      status: "VACANT",
      priceMonthly: 11500,
    },
    {
      pgId: pgOne._id,
      roomNo: "201",
      bedNo: "A",
      sharingType: 2,
      genderTag: "FEMALE",
      ac: true,
      attachedBath: false,
      status: "BLOCKED",
      lockExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      priceMonthly: 13000,
    },
    {
      pgId: pgTwo._id,
      roomNo: "301",
      bedNo: "A",
      sharingType: 2,
      genderTag: "MALE",
      ac: true,
      attachedBath: true,
      status: "OCCUPIED",
      priceMonthly: 14500,
      tenantUserId: tenantThree._id,
    },
    {
      pgId: pgTwo._id,
      roomNo: "301",
      bedNo: "B",
      sharingType: 2,
      genderTag: "MALE",
      ac: true,
      attachedBath: true,
      status: "VACANT",
      priceMonthly: 14500,
    },
    {
      pgId: pgThree._id,
      roomNo: "102",
      bedNo: "A",
      sharingType: 3,
      genderTag: "FEMALE",
      ac: false,
      attachedBath: false,
      status: "VACANT",
      priceMonthly: 9800,
    },
    {
      pgId: pgThree._id,
      roomNo: "102",
      bedNo: "B",
      sharingType: 3,
      genderTag: "FEMALE",
      ac: false,
      attachedBath: false,
      status: "LEAVING",
      priceMonthly: 9800,
    },
  ]);

  const booking = await Booking.create({
    userId: tenantTwo._id,
    pgId: pgOne._id,
    bedId: beds[2]._id,
    bookingType: "TOKEN",
    status: "PENDING",
    amount: 999,
    lockExpiresAt: beds[2].lockExpiresAt,
    notes: "Token paid, awaiting final confirmation.",
  });

  const payment = await Payment.create({
    bookingId: booking._id,
    userId: tenantTwo._id,
    ownerId: ownerOne._id,
    paymentType: "TOKEN",
    totalAmount: 999,
    platformFee: 100,
    ownerPayout: 899,
    status: "SUCCESS",
    gatewayRef: "pay_demo_token_001",
  });

  booking.paymentId = payment._id;
  await booking.save();

  const bookingTwo = await Booking.create({
    userId: tenantThree._id,
    pgId: pgTwo._id,
    bedId: beds[4]._id,
    bookingType: "FULL",
    status: "CONFIRMED",
    amount: 14500,
    notes: "Moved in after site visit confirmation.",
  });

  const paymentTwo = await Payment.create({
    bookingId: bookingTwo._id,
    userId: tenantThree._id,
    ownerId: ownerOne._id,
    paymentType: "RENT",
    totalAmount: 14500,
    platformFee: 1450,
    ownerPayout: 13050,
    status: "SUCCESS",
    gatewayRef: "pay_demo_rent_002",
  });

  bookingTwo.paymentId = paymentTwo._id;
  await bookingTwo.save();

  await Payment.create({
    bookingId: booking._id,
    userId: tenantTwo._id,
    ownerId: ownerOne._id,
    paymentType: "TOKEN",
    totalAmount: 999,
    platformFee: 100,
    ownerPayout: 899,
    status: "REFUNDED",
    gatewayRef: "pay_demo_token_refund_003",
  });

  await RentCycle.create([
    {
      bedId: beds[0]._id,
      tenantUserId: tenantOne._id,
      monthKey: "2026-05",
      dueDate: new Date("2026-05-05T00:00:00.000Z"),
      amount: 11500,
      status: "DUE",
    },
    {
      bedId: beds[3]._id,
      tenantUserId: tenantThree._id,
      monthKey: "2026-05",
      dueDate: new Date("2026-05-05T00:00:00.000Z"),
      amount: 14500,
      status: "PAID",
      paidAt: new Date("2026-04-30T00:00:00.000Z"),
    },
  ]);

  await Ticket.create([
    {
      userId: tenantOne._id,
      pgId: pgOne._id,
      type: "COMPLAINT",
      description: "WiFi speed is low after 10 PM.",
      status: "OPEN",
    },
    {
      userId: tenantTwo._id,
      pgId: pgOne._id,
      type: "REFUND",
      description: "Need token refund due to owner rejection.",
      status: "IN_PROGRESS",
    },
    {
      userId: tenantThree._id,
      pgId: pgTwo._id,
      type: "VACATE",
      description: "Planning to vacate by end of month.",
      status: "OPEN",
    },
  ]);

  await SavedPaymentMethod.create([
    {
      userId: tenantOne._id,
      brand: "VISA",
      holderName: tenantOne.name,
      last4: "4242",
      expiryMonth: 4,
      expiryYear: 2029,
      isDefault: true,
      status: "ACTIVE",
    },
    {
      userId: tenantOne._id,
      brand: "UPI",
      holderName: tenantOne.name,
      last4: "0001",
      upiId: "rahul@upi",
      isDefault: false,
      status: "ACTIVE",
    },
  ]);

  await PlatformConfig.insertMany([
    { key: "default_commission_pct", value: 10 },
    { key: "platform_name", value: "PGConnect" },
    { key: "support_email", value: "support@pghub.com" },
    { key: "risk_alerts_enabled", value: true },
  ]);

  await AuditLog.create([
    {
      actorUserId: admin._id,
      actorRole: "ADMIN",
      entityType: "PgProperty",
      entityId: pgOne._id.toString(),
      action: "VERIFY_PG",
      before: { verified: false },
      after: { verified: true },
    },
    {
      actorUserId: admin._id,
      actorRole: "ADMIN",
      entityType: "User",
      entityId: tenantThree._id.toString(),
      action: "USER_STATUS",
      before: { status: "ACTIVE" },
      after: { status: "BLOCKED" },
    },
    {
      actorUserId: admin._id,
      actorRole: "ADMIN",
      entityType: "OwnerProfile",
      entityId: "seed-owner-one-kyc",
      action: "KYC_UPDATE",
      before: { kycStatus: "PENDING" },
      after: { kycStatus: "VERIFIED" },
    },
  ]);

  // eslint-disable-next-line no-console
  console.log("Seed complete.");
  // eslint-disable-next-line no-console
  console.log("Login users:");
  // eslint-disable-next-line no-console
  console.log("admin 9000000001 / Pass@123");
  // eslint-disable-next-line no-console
  console.log("owner 9000000002 / Pass@123");
  // eslint-disable-next-line no-console
  console.log("user  9000000003 / Pass@123");
  // eslint-disable-next-line no-console
  console.log("owner 9000000005 / Pass@123");
  // eslint-disable-next-line no-console
  console.log("owner pending KYC 9000000007 / Pass@123");
}

seed()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Seeding failed:", error);
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

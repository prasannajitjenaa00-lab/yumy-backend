const mongoose = require("mongoose");

const HOLIDAY_TYPES = [
  "PUBLIC_HOLIDAY",
  "FESTIVAL_HOLIDAY",
  "COMPANY_HOLIDAY",
  "RESTAURANT_CLOSED",
  "WEEKLY_OFF",
  "SPECIAL_OFF",
];

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: HOLIDAY_TYPES,
      default: "PUBLIC_HOLIDAY",
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, default: null },
    description: { type: String, trim: true, default: "" },
    reason: { type: String, trim: true, default: "" },
    appliesTo: {
      type: String,
      enum: ["ORGANIZATION", "DEPARTMENTS", "EMPLOYEES"],
      default: "ORGANIZATION",
    },
    departments: {
      type: [String],
      default: [],
    },
    employees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isRecurring: { type: Boolean, default: false },
    recurringDay: {
      type: String,
      enum: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT", null],
      default: null,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    notifyEmployees: { type: Boolean, default: false },
    color: { type: String, default: "" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

holidaySchema.index({ startDate: 1, endDate: 1 });
holidaySchema.index({ status: 1 });
holidaySchema.index({ isRecurring: 1 });

module.exports = mongoose.model("Holiday", holidaySchema);
module.exports.HOLIDAY_TYPES = HOLIDAY_TYPES;

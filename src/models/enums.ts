export enum AppointmentStatus {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    CANCELLED_BY_CLIENT = "CANCELLED_BY_CLIENT",
    CANCELLED_BY_ADMIN = "CANCELLED_BY_ADMIN",
    DONE = "DONE",
    NO_SHOW = "NO_SHOW"
}
export enum UserStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE"
}
export enum serviceStatus {
    ACTIVE = "ACTIVE",
    INACTIVE = "INACTIVE",
    DELETED = "DELETED",
    liqUIDATED = "LIQUIDATED"
}
export enum offerType {
    DISCOUNT = "DISCOUNT",
    COMBO = "COMBO"
}

export enum UserRole {
    ADMIN = "ADMIN",
    DOCTOR = "DOCTOR",
    RECEPTIONIST = "RECEPTIONIST"
}
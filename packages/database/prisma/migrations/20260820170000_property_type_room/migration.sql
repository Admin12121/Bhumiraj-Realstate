-- Renting a single room is the common case in Kathmandu and had no property type.
ALTER TYPE "PropertyType" ADD VALUE IF NOT EXISTS 'ROOM';

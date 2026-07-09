/**
 * price converter utility functions
 * NOTE: intentionally skip currency rates and just convert to/from cents for now, since we only support EUR
 */


export const convertPriceToCents = (price: number): number => {
  return Math.round(price * 100);
};

export const convertCentsToPrice = (cents: number): number => {
  return cents / 100;
};
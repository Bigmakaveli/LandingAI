import { 
  createGiftCard, 
  getAllGiftCards, 
  getGiftCardById, 
  updateGiftCard, 
  deleteGiftCard,
  GiftCard 
} from './database';

// ===== LOGGING UTILITIES =====
const log = {
  request: (action: string, details?: string) => console.log(`[${action}] ${details || ''}`),
  step: (step: string, details?: string) => console.log(`[Step] ${step}${details ? `: ${details}` : ''}`),
  result: (action: string, success: boolean, details?: any) => 
    console.log(`[${action}] ${success ? 'SUCCESS' : 'FAILED'}${details ? `: ${JSON.stringify(details)}` : ''}`),
  error: (action: string, error: any) => console.error(`[${action}] ERROR:`, error),
  info: (action: string, message: string) => console.log(`[${action}] ${message}`)
};

// ===== GIFT CARD MANAGEMENT =====

export interface CreateGiftCardRequest {
  name: string;
  description?: string;
  price: number;
}

export interface UpdateGiftCardRequest {
  id: number;
  name: string;
  description?: string;
  price: number;
}

export interface GiftCardResponse {
  success: boolean;
  data?: GiftCard;
  error?: string;
}

export interface GiftCardListResponse {
  success: boolean;
  data?: GiftCard[];
  error?: string;
}

export async function addGiftCard(siteId: string, request: CreateGiftCardRequest): Promise<GiftCardResponse> {
  try {
    log.request('Add Gift Card', `Creating gift card: ${request.name} for site ${siteId}`);
    
    // Validate input
    if (!request.name || request.name.trim().length === 0) {
      return {
        success: false,
        error: 'Gift card name is required'
      };
    }
    
    if (request.price < 0) {
      return {
        success: false,
        error: 'Gift card price must be non-negative'
      };
    }
    
    const giftCard = await createGiftCard(
      siteId,
      request.name.trim(),
      request.description?.trim() || null,
      request.price
    );
    
    log.result('Add Gift Card', true, `Created gift card ${giftCard.id} for site ${siteId}`);
    return {
      success: true,
      data: giftCard
    };
  } catch (error) {
    log.error('Add Gift Card', error);
    return {
      success: false,
      error: 'Failed to create gift card'
    };
  }
}

export async function editGiftCard(siteId: string, request: UpdateGiftCardRequest): Promise<GiftCardResponse> {
  try {
    log.request('Edit Gift Card', `Updating gift card: ${request.id} for site ${siteId}`);
    
    // Validate input
    if (!request.name || request.name.trim().length === 0) {
      return {
        success: false,
        error: 'Gift card name is required'
      };
    }
    
    if (request.price < 0) {
      return {
        success: false,
        error: 'Gift card price must be non-negative'
      };
    }
    
    const giftCard = await updateGiftCard(
      siteId,
      request.id,
      request.name.trim(),
      request.description?.trim() || null,
      request.price
    );
    
    if (!giftCard) {
      return {
        success: false,
        error: 'Gift card not found'
      };
    }
    
    log.result('Edit Gift Card', true, `Updated gift card ${giftCard.id} for site ${siteId}`);
    return {
      success: true,
      data: giftCard
    };
  } catch (error) {
    log.error('Edit Gift Card', error);
    return {
      success: false,
      error: 'Failed to update gift card'
    };
  }
}

export async function removeGiftCard(siteId: string, id: number): Promise<GiftCardResponse> {
  try {
    log.request('Remove Gift Card', `Deleting gift card: ${id} for site ${siteId}`);
    
    const success = await deleteGiftCard(siteId, id);
    
    if (!success) {
      return {
        success: false,
        error: 'Gift card not found'
      };
    }
    
    log.result('Remove Gift Card', true, `Deleted gift card ${id} for site ${siteId}`);
    return {
      success: true
    };
  } catch (error) {
    log.error('Remove Gift Card', error);
    return {
      success: false,
      error: 'Failed to delete gift card'
    };
  }
}

export async function listGiftCards(siteId: string): Promise<GiftCardListResponse> {
  try {
    log.request('List Gift Cards', `Retrieving gift cards for site ${siteId}`);
    
    const giftCards = await getAllGiftCards(siteId);
    
    log.result('List Gift Cards', true, `Retrieved ${giftCards.length} gift cards for site ${siteId}`);
    return {
      success: true,
      data: giftCards
    };
  } catch (error) {
    log.error('List Gift Cards', error);
    return {
      success: false,
      error: 'Failed to retrieve gift cards'
    };
  }
}

export async function getGiftCard(siteId: string, id: number): Promise<GiftCardResponse> {
  try {
    log.request('Get Gift Card', `Retrieving gift card: ${id} for site ${siteId}`);
    
    const giftCard = await getGiftCardById(siteId, id);
    
    if (!giftCard) {
      return {
        success: false,
        error: 'Gift card not found'
      };
    }
    
    log.result('Get Gift Card', true, `Retrieved gift card ${id} for site ${siteId}`);
    return {
      success: true,
      data: giftCard
    };
  } catch (error) {
    log.error('Get Gift Card', error);
    return {
      success: false,
      error: 'Failed to retrieve gift card'
    };
  }
}

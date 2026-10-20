export type OfferStatus = 'pending' | 'accepted' | 'withdrawn' | 'declined' | 'completed' | 'cancelled' | 'expired';
export type Offer = { id: string; request_id: string; requester_id: string; helper_id: string; helper_name: string; request_title: string; message: string; status: OfferStatus; created_at: string; updated_at: string };

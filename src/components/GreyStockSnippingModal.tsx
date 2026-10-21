import React, { useMemo } from 'react';
import { GreyStockOrderGroup } from '../types';
import { KnittingOrderSnippingModal } from './KnittingOrderSnippingModal';
import { resolveKnittingOrderForSnipping } from '../lib/knittingStatusStore';
import { useGlobalData } from '../context/GlobalDataContext';

interface GreyStockSnippingModalProps {
  orderGroup: GreyStockOrderGroup | null;
  isOpen: boolean;
  onClose: () => void;
}

export const GreyStockSnippingModal: React.FC<GreyStockSnippingModalProps> = ({
  orderGroup,
  isOpen,
  onClose
}) => {
  const { orderPlans = [], textileRecords = [], yarnAllocations = [] } = useGlobalData();

  const resolvedOrder = useMemo(() => {
    if (!orderGroup || !orderGroup.orderNo) return null;
    return resolveKnittingOrderForSnipping(
      orderGroup.orderNo,
      {
        buyerName: orderGroup.buyerName,
        items: orderGroup.items
      },
      orderPlans,
      textileRecords,
      yarnAllocations
    );
  }, [orderGroup, orderPlans, textileRecords, yarnAllocations]);

  if (!isOpen || !orderGroup) return null;

  return (
    <KnittingOrderSnippingModal
      order={resolvedOrder}
      isOpen={isOpen}
      onClose={onClose}
      initialMode="grey_stock"
      includeAllocation={true}
    />
  );
};

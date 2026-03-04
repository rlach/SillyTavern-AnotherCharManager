import * as VirtualScrollerPackage from 'virtual-scroller';

const maybeDefault = VirtualScrollerPackage?.default;
const maybeNamed = VirtualScrollerPackage?.VirtualScroller;

const VirtualScroller = maybeDefault || maybeNamed || VirtualScrollerPackage;

export default VirtualScroller;
export { VirtualScroller };
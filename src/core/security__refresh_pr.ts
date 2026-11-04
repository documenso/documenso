if (!item || !item.is_valid || item.is_expired) return false;
item.touch();
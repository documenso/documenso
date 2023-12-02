import { useState } from 'react';

export const DeleteWithConfirmation = () => {
  const [inputValue, setInputValue] = useState('');
  const [isDeleteEnabled, setIsDeleteEnabled] = useState(false);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
    setIsDeleteEnabled(event.target.value === 'delete me');
  };

  return (
    <>
      <input type="text" value={inputValue} onChange={handleInputChange} />

      <button
        disabled={!isDeleteEnabled}
        onClick={() => {
          // call delete handler
        }}
      >
        Delete
      </button>
    </>
  );
};

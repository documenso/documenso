import React from "react";

type Props = {
  options: Option[];
  placeholder: string;
  value: string | number;
  onChange: (value: string | number) => void;
};
type Option = {
  text: string;
  value: number;
};
const Dropdown = (props: Props) => {
  const [showOptions, setShowOptions] = React.useState(false);
  return (
    <label className="dropdown relative inline-block">
      <div className="mr-1dd-button ml-1 inline-block cursor-pointer whitespace-nowrap rounded-lg border border-gray-400 bg-white px-4 py-2">
        {props.value || props.placeholder}
      </div>

      <input
        type="checkbox"
        className="dd-input hidden"
        id="test"
        onClick={() => {
          setShowOptions(!showOptions);
        }}
      />
      {showOptions ? (
        <ul className="dd-menu absolute top-full m-2 w-16 rounded-lg border border-gray-300 bg-white shadow-lg">
          {props.options.map((option) => (
            <li
              key={option.text}
              className="cursor-pointer whitespace-nowrap rounded-md px-4 py-2 text-center hover:bg-slate-200"
              onClick={() => {
                props.onChange(option.value);
              }}>
              {option.text}
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
};
export default Dropdown;

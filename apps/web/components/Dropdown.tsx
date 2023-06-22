import React from "react";
type Props = {
  options: Option[],
  placeholder: string
}
type Option = {
  text: string
  value: string
}
const Dropdown = (props: Props) => {
  const [showOptions, setShowOptions] = React.useState(false)
  return (
    <label className="dropdown inline-block relative">

      <div className="ml-1 mr-1dd-button inline-block border border-gray-400 rounded-lg px-4 py-2 bg-white cursor-pointer whitespace-nowrap">
        {props.placeholder}
      </div>

      <input type="checkbox" className="dd-input hidden" id="test" onClick={() => {
        setShowOptions(!showOptions)
      }} />
      {showOptions ? (
        <ul className="dd-menu absolute top-full border border-gray-300 rounded-lg p-0 m-2 shadow-lg bg-white">
          <li className="px-4 py-2 cursor-pointer whitespace-nowrap" >25</li>
          <li className="px-4 py-2 cursor-pointer whitespace-nowrap">75</li>
          <li className="px-4 py-2 cursor-pointer whitespace-nowrap">100</li>
          <li className="divider border-b border-gray-200"></li>
        </ul>
      ) : null}


    </label>


  )
}
export default Dropdown

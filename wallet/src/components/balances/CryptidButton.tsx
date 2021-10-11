import * as React from "react";
import {Tooltip} from "@material-ui/core";
// TODO: @Daniel did you want this from @material-ui?

const classNames = (...classes) => classes.filter(Boolean).join(' ');

type TokenButtonProps = {
  label: string,
  Icon: (props: React.ComponentProps<'svg'>) => JSX.Element
  additionalClasses?: string,
  onClick: () => void,
  disabled?: boolean,
}
export const CryptidButton: React.FC<TokenButtonProps> = ({label, Icon, onClick, additionalClasses = '', disabled }) => {
  console.log("disabled " + disabled);
  return (<Tooltip title={label} arrow>
      <button
        disabled={!!disabled}
        type="button"
        className={classNames(
          "group relative inline-flex items-center px-2 py-2",
          "border border-grey-300 bg-white text-sm font-medium text-red-800",
          "disabled:text-gray-300 disabled:pointer-events-none",
          "hover:bg-red-50 rounded-md",
          "focus:z-10 focus:outline-none focus:ring-1 focus:ring-red-800 focus:border-red-800",
          additionalClasses,
        )}
        onClick={onClick}
      >
        <span className="pr-2">{label}</span>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </button>
    </Tooltip>
  )};
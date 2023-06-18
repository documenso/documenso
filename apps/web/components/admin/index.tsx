import React from "react";
import AdminPageWrapper from "./adminPageWrapper";
type Props = {};

const index = (props: Props) => {
  return (
    <AdminPageWrapper>
       <table id="basic-data-table" className="table table-auto w-3/4">
    <thead>
        <tr>
            <th className="px-4 py-2">First name</th>
            <th className="px-4 py-2">Last name</th>
            <th className="px-4 py-2">Position</th>
            <th className="px-4 py-2">Office</th>
            <th className="px-4 py-2">Age</th>
            <th className="px-4 py-2">Start date</th>
            <th className="px-4 py-2">Salary</th>
            <th className="px-4 py-2">Extn.</th>
            <th className="px-4 py-2">E-mail</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td className="border px-4 py-2">Tiger</td>
            <td className="border px-4 py-2">Nixon</td>
            <td className="border px-4 py-2">System Architect</td>
            <td className="border px-4 py-2">Edinburgh</td>
            <td className="border px-4 py-2">61</td>
            <td className="border px-4 py-2">2011/04/25</td>
            <td className="border px-4 py-2">320,800</td>
            <td className="border px-4 py-2">5421</td>
            <td className="border px-4 py-2">t.nixon@datatables.net</td>
        </tr>
        <tr>
            <td className="border px-4 py-2">Garrett</td>
            <td className="border px-4 py-2">Winters</td>
            <td className="border px-4 py-2">Accountant</td>
            <td className="border px-4 py-2">Tokyo</td>
            <td className="border px-4 py-2">63</td>
            <td className="border px-4 py-2">2011/07/25</td>
            <td className="border px-4 py-2">170,750</td>
            <td className="border px-4 py-2">8422</td>
            <td className="border px-4 py-2">g.winters@datatables.net</td>
        </tr>
    </tbody>
</table>

    </AdminPageWrapper>
  )
};

export default index;

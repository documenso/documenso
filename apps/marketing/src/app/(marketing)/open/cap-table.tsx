'use client';

import type { HTMLAttributes } from 'react';
import { useEffect, useState } from 'react';

import { Cell, Legend, Pie, PieChart, Tooltip } from 'recharts';

import { CAP_TABLE } from './data';

const COLORS = ['#7fd843', '#a2e771', '#c6f2a4'];
const RADIAN = Math.PI / 180;

export type LabelRenderProps = {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
};

const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: LabelRenderProps) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.25;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
};

export type CapTableProps = HTMLAttributes<HTMLDivElement>;

export const CapTable = ({ className, ...props }: CapTableProps) => {
  const [isSSR, setIsSSR] = useState(true);

  useEffect(() => {
    setIsSSR(false);
  }, []);
  return (
    <div className={className} {...props}>
      <div className="border-border flex flex-col justify-center rounded-2xl border p-6 pl-2 shadow-sm hover:shadow">
        <div className="mb-6 flex px-4">
          <h3 className="text-lg font-semibold">Cap Table</h3>
        </div>

        {!isSSR && (
          <PieChart width={400} height={400}>
            <Pie
              data={CAP_TABLE}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomizedLabel}
              outerRadius={160}
              innerRadius={80}
              fill="#8884d8"
              dataKey="percentage"
            >
              {CAP_TABLE.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Legend
              formatter={(value) => {
                return <span className="text-foreground text-sm">{value}</span>;
              }}
            />
            <Tooltip
              formatter={(percent: number, name, props) => {
                return [`${percent}%`, name || props['name'] || props['payload']['name']];
              }}
            />
          </PieChart>
        )}
      </div>
    </div>
  );
};

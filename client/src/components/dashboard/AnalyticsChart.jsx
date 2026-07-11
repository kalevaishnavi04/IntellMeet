import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function AnalyticsChart() {
  const data = [
    { month: "Jan", meetings: 20 },
    { month: "Feb", meetings: 35 },
    { month: "Mar", meetings: 28 },
    { month: "Apr", meetings: 45 },
    { month: "May", meetings: 52 },
    { month: "Jun", meetings: 60 },
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-md mt-6">
      <h2 className="text-xl font-semibold mb-4">
        Meeting Analytics
      </h2>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="meetings"
            stroke="#6366F1"
            strokeWidth={3}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default AnalyticsChart;
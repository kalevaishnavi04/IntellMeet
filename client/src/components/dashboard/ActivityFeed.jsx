function ActivityFeed() {
  const activities = [
    "Meeting Created",
    "User Joined Meeting",
    "Task Assigned",
    "AI Summary Generated",
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-semibold mb-4">
        Recent Activity
      </h2>

      {activities.map((activity, index) => (
        <div
          key={index}
          className="border-b py-3"
        >
          ✅ {activity}
        </div>
      ))}
    </div>
  );
}

export default ActivityFeed;
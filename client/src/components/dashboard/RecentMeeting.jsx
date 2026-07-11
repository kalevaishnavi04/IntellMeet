function RecentMeetings() {
  const meetings = [
    "Project Discussion",
    "Client Call",
    "Team Sync",
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-semibold mb-4">
        Recent Meetings
      </h2>

      {meetings.map((meeting, index) => (
        <div
          key={index}
          className="border-b py-3"
        >
          {meeting}
        </div>
      ))}
    </div>
  );
}

export default RecentMeetings;
function UpcomingMeetings() {
  const meetings = [
    {
      title: "Sprint Planning",
      date: "18 June 2026",
      time: "10:00 AM",
    },
    {
      title: "Client Discussion",
      date: "19 June 2026",
      time: "2:00 PM",
    },
    {
      title: "Project Review",
      date: "20 June 2026",
      time: "4:00 PM",
    },
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow-md mt-6">
      <h2 className="text-xl font-semibold mb-4">
        Upcoming Meetings
      </h2>

      {meetings.map((meeting, index) => (
        <div
          key={index}
          className="border-b py-3"
        >
          <h3 className="font-medium">
            {meeting.title}
          </h3>

          <p className="text-gray-500 text-sm">
            {meeting.date} | {meeting.time}
          </p>
        </div>
      ))}
    </div>
  );
}

export default UpcomingMeetings;
from django.contrib import admin

from tasks.models import User, Task, Zone, TaskSettings, Position


admin.site.register(User)
admin.site.register(Task)
admin.site.register(Zone)
admin.site.register(TaskSettings)
admin.site.register(Position)
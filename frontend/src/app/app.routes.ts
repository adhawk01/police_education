import { Routes } from '@angular/router';
import { guestOnlyGuard, authGuard } from './auth/auth.guards';
import { LoginComponent } from './auth/login/login.component';
import { RegisterComponent } from './auth/register/register.component';
import { HomeComponent } from './home/home.component';
import { AuthenticatedShellComponent } from './layout/authenticated-shell.component';
import { SearchComponent } from './search/search.component';

export const routes: Routes = [
	{ path: '', pathMatch: 'full', redirectTo: 'login' },
	{ path: 'login', component: LoginComponent, canActivate: [guestOnlyGuard] },
	{ path: 'register', component: RegisterComponent, canActivate: [guestOnlyGuard] },
	{
		path: '',
		component: AuthenticatedShellComponent,
		canActivate: [authGuard],
		children: [
			{ path: 'home', component: HomeComponent },
			{ path: 'search', component: SearchComponent }
		]
	},
	{ path: '**', redirectTo: 'login' }
];

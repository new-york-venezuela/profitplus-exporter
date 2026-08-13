# SP: pv_ObtenerCamposAdi
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saAdiCampo`](../tables/saAdiCampo.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			PV_ObtenerCamposAdi
DESCRIPCION:	OBTIENE LA URL USADA PARA LA CONEXION CON EL SENIAT
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerCamposAdi] 
(
	@sCo_AdiGrupo CHAR(8),
	@sCo_AdiCampo CHAR(8)
)
AS 
    BEGIN	
		  SELECT val_str  FROM saAdiCampo 
			WHERE co_adigrupo = @sCo_AdiGrupo AND co_adicampo = @sCo_AdiCampo
    END
```

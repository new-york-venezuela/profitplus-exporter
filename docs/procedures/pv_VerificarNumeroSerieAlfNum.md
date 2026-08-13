# SP: pv_VerificarNumeroSerieAlfNum
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`saSerie`](../tables/saSerie.md)

## Código (excerpt)
```sql
/**************************************************************************/
/*NOMBRE			: [pv_ActualizarSerieAlfNum]*/
/*DESCRIPCIÓN	: VERIFICA SI EL NUMERO DE LA SERIE ESTÁ DENTRO DEL RANGO*/
/*AUTOR			: SOFTECH SISTEMAS*/
/**************************************************************************/ 
CREATE PROCEDURE [dbo].[pv_VerificarNumeroSerieAlfNum]
	 (
		@Co_Serie			CHAR(20) ,
		@Prox_n				BIGINT				=	NULL ,
		@Prox_a				CHAR(20)			=	NULL 


	 )
AS
	BEGIN
		IF (@Prox_n <> 0)
			BEGIN
				SELECT 
					(CASE 
						WHEN (@Prox_n >= desde_n and @Prox_n <= hasta_n) 
							THEN
								1
							ELSE
								0
					END) retorno
				FROM saSerie 
				WHERE 
					co_serie = @Co_Serie
			END
		IF (@Prox_a is not null)
			BEGIN
				SELECT 
					(CASE 
						WHEN (@Prox_a >= desde_a and @Prox_a <= hasta_a) 
							THEN
								1
							ELSE
								0
					END) retorno
				FROM saSerie 
				WHERE 
					co_serie = @Co_Serie
			END

END
```

# SP: RepArticuloCaracteristicaStock
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)
- [`saArtUnidad`](../tables/saArtUnidad.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)
- [`saUnidad`](../tables/saUnidad.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: RepArticuloCaracteristicaStock
DESCRIPCION: Reporte de Articulos con Todos sus Stocks
CREADO POR: SOFTECH SISTEMAS
LAST DATE:2017-06-27
***************************************************************************************************************/ 
CREATE PROCEDURE [dbo].[RepArticuloCaracteristicaStock]
	-- Add the parameters for the stored procedure here
    @sco_art char(30) = NULL, 
    @dFecha_hasta Datetime = NULL,
    @sco_subl01 char(6) = NULL,
    @sco_subl02 char(6) = NULL,
    @sco_subl03 char(6) = NULL,
    @sco_subl04 char(6) = NULL,
    @sco_subl05 char(6) = NULL,
    @bHeaderRep BIT = 0
AS 
    BEGIN
     
    SET NOCOUNT ON;

IF (@sco_art IS  NULL)    
        BEGIN
			RAISERROR('No es posible ejecutar el reporte, debe seleccionar un artículo.',16,1);
			RETURN
		END        

Select  
		P.co_art, P.art_des,
		AU.co_uni, U.des_uni, 
			  A.co_lin01 as co_lin01, L01.lin_des as lin_des01, LIN01.co_subl as co_subl01,  LIN01.subl_des as des_subl01,
              A.co_lin02 as co_lin02,L02.lin_des as lin_des02, LIN02.co_subl as co_subl02,LIN02.subl_des as des_subl02,
              A.co_lin03 as co_lin03, L03.lin_des as lin_des03, LIN03.co_subl as co_subl03, LIN03.subl_des as des_subl03,
              A.co_lin04 as co_lin04, L04.lin_des as lin_des04,LIN04.co_subl as co_subl04, LIN04.subl_des as des_subl04,
              A.co_lin05 as co_lin05, L05.lin_des as lin_des05, LIN05.co_subl as co_subl05, LIN05.subl_des as des_subl05,
             ISNULL(SUM(C.cantidad),0.00000) as stock
  From [dbo].[saArtCaracteristica] A 
  INNER JOIN [dbo].[saArticulo] P ON P.co_art = A.co_art
  LEFT JOIN [dbo].[saLineaArticulo] L01 ON L01.co_lin = A.co_lin01
  LEFT JOIN [dbo].[saLineaArticulo] L02 ON L02.co_lin = A.co_lin02
  LEFT JOIN [dbo].[saLineaArticulo] L03 ON L03.co_lin = A.co_lin03
  LEFT JOIN [dbo].[saLineaArticulo] L04 ON L04.co_lin = A.co_lin04
  LEFT JOIN [dbo].[saLineaArticulo] L05 ON L05.co_lin = A.co_lin05
  FULL OUTER JOIN [dbo].[saSublinea] LIN01 ON LIN01.co_lin = A.co_lin01
  FULL OUTER JOIN [dbo].[saSublinea] LIN02 ON LIN02.co_lin = A.co_lin02
  FULL OUTER JOIN [dbo].[saSublinea] LIN03 ON LIN03.co_lin = A.co_lin03
  FULL OUTER JOIN [dbo].[saSublinea] LIN04 ON LIN04.co_lin = A.co_lin04
  FULL OUTER JOIN [dbo].[saSublinea] LIN05 ON LIN05.co_lin = A.co_lin05
  LEFT JOIN [dbo].[savArtCara
```

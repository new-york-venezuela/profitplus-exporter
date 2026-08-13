# SP: pv_ObtenerArtCaracteristica
**Tipo**: Punto de Venta
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArtCaracteristica`](../tables/saArtCaracteristica.md)
- [`saLineaArticulo`](../tables/saLineaArticulo.md)
- [`saSubLinea`](../tables/saSubLinea.md)

## Código (excerpt)
```sql
/*********************************************************************
*NOMBRE			:	pv_SeleccionarArtCaracteristica
*DESCRIPCIÓN	:	OBTIENE LAS LINEAS QUE TIENE ASIGNADAS UN ARTICULO DADO
*AUTOR			:	SOFTECH SISTEMAS
*********************************************************************/ 
CREATE PROCEDURE [dbo].[pv_ObtenerArtCaracteristica]
@sCoArt CHAR(30), 
 @sCoAlma CHAR(6) = NULL,
@UNI CHAR(6) = NULL 

AS BEGIN 

SET NOCOUNT ON;

DECLARE @lin1 CHAR(6), @lin2 CHAR(6), @lin3 CHAR(6), @lin4 CHAR(6), @lin5 CHAR(6)

 
--se busca las 5 lineas predeterminadas con las que el artículo trabaja y se guardan cada una en una variable
select @lin1 = co_lin01, @lin2 = co_lin02, @lin3 = co_lin03, @lin4 = co_lin04, @lin5 = co_lin05 from [dbo].[saArtCaracteristica] where co_art = @sCoArt

select co_lin, lin_des, 
(case  when co_lin = @lin1 then 0  
             when co_lin = @lin2 then 1 
             when co_lin = @lin3 then 2 
             when co_lin = @lin4 then 3 
             when co_lin = @lin5 then 4 end ) as num 
 from salineaArticulo where co_lin in(@lin1,@lin2,@lin3,@lin4,@lin5)

 --return
SELECT  
      (select subl_des from [dbo].[saSubLinea] a where  a.[co_lin] = sublineas.[co_lin1] and a.[co_subl] = sublineas.[co_subl1]) as lin1
      ,(select subl_des from [dbo].[saSubLinea] a where  a.[co_lin] = sublineas.[co_lin2] and a.[co_subl] = sublineas.[co_subl2]) as lin2
      ,(select subl_des from [dbo].[saSubLinea] a where  a.[co_lin] = sublineas.[co_lin3] and a.[co_subl] = sublineas.[co_subl3]) as lin3
      ,(select subl_des from [dbo].[saSubLinea] a where  a.[co_lin] = sublineas.[co_lin4] and a.[co_subl] = sublineas.[co_subl4]) as lin4
      ,(select subl_des from [dbo].[saSubLinea] a where  a.[co_lin] = sublineas.[co_lin5] and a.[co_subl] = sublineas.[co_subl5]) as lin5
         , (CASE WHEN datos.cantidad IS NULL THEN 0 ELSE datos.cantidad END) as cantidad from
---la subtabla datos contiene los movimientos y sus cantidades, agrupados
(select [co_art],[co_alma], [co_uni]
         ,vista.[co_lin01], vista.[co_lin02]
         ,vista.[co_lin03], vista.[co_lin04]
         ,vista.[co_lin05], vista.[co_subl01]
         ,vista.[co_subl02], vista.[co_subl03]
         ,vista.[co_subl04], vista.[co_subl05]   
      ,sum([cantidad]) as Cantidad
          from [dbo].[savArtCaracteristica] vista      
         where vista.co_art = @sCoArt AND vista.co_alma = @sCoAlma
          group by     vista.[co_art]      ,vista.[co_alma]
```
